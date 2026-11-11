import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { WindowHeader } from './components/WindowHeader';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { CreateChannelModal } from './components/CreateChannelModal';
import { AddFriendModal } from './components/AddFriendModal';
import { AddMemberModal } from './components/AddMemberModal';
import { PeerConnectModal } from './components/PeerConnectModal';
import { SettingsModal } from './components/SettingsModal';
import { LogoutConfirmModal } from './components/LogoutConfirmModal';
import { RemoteAudioPlayers } from './components/RemoteAudioPlayers';
import { ProtectedRoute, PublicRoute } from './components/ProtectedRoute';
import { AuthPage } from './components/AuthPage';
import { useVoiceWebRTC } from './hooks/useVoiceWebRTC';
import { useRealtimeChat } from './hooks/useRealtimeChat';
import { useGameDetection } from './hooks/useGameDetection';
import { SettingsProvider } from './context/SettingsContext';
import { useSettings } from './context/useSettings';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import { chatService } from './services/chatService';
import { dbService, getDmRoomId, isSupabaseConfigured } from './lib/supabase';
import { sounds } from './utils/audio';
import { pickDisplayName, getCachedUserProfile, isUuidLike } from './utils/userDisplay';

const getUserChannelsCacheKey = (uid) => (uid ? `voys_user_channels_${uid}` : null);

function StanduppApp() {
  const navigate = useNavigate();
  const location = useLocation();

  // Authentication Context
  const { user, logout } = useAuth();

  // Settings & Profile Context
  const {
    profile,
    updateProfile,
    selectedAudioOutput,
    outputVolume,
    openSettings,
    inputMode,
    isPttActive,
  } = useSettings();

  // Automatic Game Detection (Rich Presence via Tauri)
  useGameDetection({
    currentGame: profile?.game,
    updateProfile,
    enabled: Boolean(user),
  });

  const handleUpdateStatus = useCallback(async (newStatus) => {
    try {
      const labels = {
        online: 'Çevrimiçi',
        idle: 'Boşta',
        dnd: 'Rahatsız Etmeyin',
        invisible: 'Çevrimdışı',
        offline: 'Çevrimdışı',
      };
      const defaultLabels = ['Çevrimiçi', 'Boşta', 'Rahatsız Etmeyin', 'Görünmez', 'Çevrimdışı', 'P2P Bağlantısı', ''];
      const currentSub = (profile?.substatus || '').trim();
      const shouldUpdateSub = !currentSub || defaultLabels.includes(currentSub);

      await updateProfile({
        status: newStatus,
        isAway: newStatus === 'idle',
        ...(shouldUpdateSub ? { substatus: labels[newStatus] || 'Çevrimiçi' } : {}),
      });
      const toastLabels = {
        online: 'Çevrimiçi',
        idle: 'Boşta',
        dnd: 'Rahatsız Etmeyin',
        invisible: 'Görünmez (Çevrimdışı)',
        offline: 'Çevrimdışı',
      };
      toast.success(`Durum güncellendi: ${toastLabels[newStatus] || labels[newStatus] || newStatus}`);
    } catch (err) {
      console.warn('Status update error:', err);
    }
  }, [updateProfile, profile?.substatus]);

  // Merged authenticated user profile
  const activeUserProfile = useMemo(() => {
    if (!user) return profile;
    const rawUsername = user.username || user.user_metadata?.username || profile.username || (user.email ? user.email.split('@')[0] : 'user');
    const rawDisplayName = user.display_name || user.user_metadata?.display_name || profile.name || rawUsername;
    const rawTag = user.tag || user.user_metadata?.tag || profile.tag || '1001';

    // Strictly own avatar from user profile; prioritize newest avatar from profile, then user
    const resolvedAvatar = (user.id === profile.id)
      ? (profile.avatar_url || profile.avatar || user.avatar_url || user.avatar || '')
      : (user.avatar_url || user.avatar || profile.avatar_url || profile.avatar || '');

    return {
      ...profile,
      id: user.id,
      name: rawDisplayName,
      display_name: rawDisplayName,
      username: rawUsername,
      tag: rawTag,
      avatar: resolvedAvatar || '',
      avatar_url: resolvedAvatar || '',
      email: user.email,
    };
  }, [profile, user]);

  // Determine if on Direct Messages (DM) route: /dm/:userId or /channel/:channelId
  const isDm = location.pathname.startsWith('/dm/');
  const pathParts = useMemo(() => location.pathname.split('/'), [location.pathname]);
  const activeDmUserId = isDm ? pathParts[2] : null;

  // Channels state with database fetch & per-user localStorage cache (only channels the user belongs to)
  const [textChannels, setTextChannels] = useState(() => {
    try {
      const cacheKey = getUserChannelsCacheKey(user?.id);
      if (!cacheKey) return [];
      const saved = localStorage.getItem(cacheKey);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed)
        ? parsed.filter((c) => c && c.id !== 'home' && c.id !== 'voice-sesli-sohbet' && !c.is_home)
        : [];
    } catch {
      return [];
    }
  });

  const [isChannelsLoading, setIsChannelsLoading] = useState(true);

  // Resiliently match active channel from textChannels
  const matchedChannel = useMemo(() => {
    if (isDm || !pathParts[2] || pathParts[2] === 'home') return null;
    const target = pathParts[2];
    const cleanTarget = String(target).toLowerCase().trim();
    const strippedTarget = cleanTarget.replace(/^(text-|voice-)/, '');

    return (
      textChannels.find((c) => {
        if (!c) return false;
        const cleanId = String(c.id || '').toLowerCase().trim();
        const strippedId = cleanId.replace(/^(text-|voice-)/, '');
        const cleanName = String(c.name || '').toLowerCase().trim();

        return (
          cleanId === cleanTarget ||
          strippedId === strippedTarget ||
          cleanId === `text-${strippedTarget}` ||
          `text-${cleanId}` === cleanTarget ||
          cleanName === cleanTarget ||
          cleanName === strippedTarget
        );
      }) || null
    );
  }, [isDm, pathParts, textChannels]);

  const activeChannel = useMemo(() => {
    if (isDm && activeDmUserId) {
      return getDmRoomId(activeUserProfile?.id, activeDmUserId);
    }
    if (pathParts[1] === 'channel' && pathParts[2] && pathParts[2] !== 'home') {
      return matchedChannel ? matchedChannel.id : null;
    }
    return null;
  }, [isDm, activeDmUserId, activeUserProfile?.id, pathParts, matchedChannel]);

  const activeChannelRef = useRef(activeChannel);
  useEffect(() => {
    activeChannelRef.current = activeChannel;
  }, [activeChannel]);

  const activeDmUserIdRef = useRef(activeDmUserId);
  useEffect(() => {
    activeDmUserIdRef.current = activeDmUserId;
  }, [activeDmUserId]);

  // Real-time Presences Map (userId -> presenceData)
  const [presences, setPresences] = useState({});

  // Listen to realtime presence updates via Socket.IO & BroadcastChannel
  useEffect(() => {
    const handlePresence = (data) => {
      if (!data) return;
      const key = data.userId || data.id;
      if (!key) return;
      setPresences((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          ...data,
          timestamp: data.timestamp || Date.now(),
        },
      }));
    };

    const handleAllPresences = (list) => {
      if (!Array.isArray(list)) return;
      setPresences((prev) => {
        const next = { ...prev };
        list.forEach((item) => {
          const key = item.userId || item.id;
          if (key) {
            next[key] = { ...next[key], ...item, timestamp: item.timestamp || Date.now() };
          }
        });
        return next;
      });
    };

    chatService.on('presence', handlePresence);
    chatService.on('all_presences', handleAllPresences);
    chatService.requestPresences?.();

    return () => {
      chatService.off('presence', handlePresence);
      chatService.off('all_presences', handleAllPresences);
    };
  }, []);

  // Periodic presence heartbeat so other clients know we are active
  useEffect(() => {
    if (!activeUserProfile?.id || activeUserProfile.id === 'you') return;
    const interval = setInterval(() => {
      chatService.updatePresence(activeUserProfile);
    }, 25000);
    return () => clearInterval(interval);
  }, [activeUserProfile]);

  // Friendships state: accepted friends, incoming requests, outgoing requests
  const [friendshipsData, setFriendshipsData] = useState({
    friends: [],
    incoming: [],
    outgoing: [],
  });

  // Active Channel Members state
  const [channelMembers, setChannelMembers] = useState([]);

  // Friend & Member Modal Open States
  const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const currentUserId = activeUserProfile?.id;

  // Load friendships callback for modals
  const loadFriendships = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const data = await dbService.fetchFriendships(currentUserId);
      if (data && Array.isArray(data.friends)) {
        setFriendshipsData(data);
      }
    } catch (err) {
      console.warn('Friendships fetch warning:', err);
    }
  }, [currentUserId]);

  useEffect(() => {
    let cancelled = false;
    let retryTimer = null;

    const fetchAsync = async (isRetry = false) => {
      if (!currentUserId || currentUserId === 'you') return;
      try {
        const data = await dbService.fetchFriendships(currentUserId);
        if (!cancelled && data && Array.isArray(data.friends)) {
          setFriendshipsData(data);
        }
      } catch (err) {
        console.warn('Friendships fetch warning:', err);
        if (!isRetry && !cancelled) {
          retryTimer = setTimeout(() => {
            if (!cancelled) fetchAsync(true);
          }, 2500);
        }
      }
    };

    fetchAsync();

    const unsubFriendships = dbService.subscribeToTable('friendships', () => {
      fetchAsync();
    });
    const unsubProfiles = dbService.subscribeToTable('profiles', () => {
      fetchAsync();
    });
    const unsubDms = dbService.subscribeToTable('direct_messages', (payload) => {
      if (
        payload?.new?.room_id === 'dm-friendship-requests' ||
        payload?.old?.room_id === 'dm-friendship-requests'
      ) {
        fetchAsync();
      }
    });

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      unsubFriendships?.();
      unsubProfiles?.();
      unsubDms?.();
    };
  }, [currentUserId, navigate]);

  // Load Channel Members callback for modals
  const loadChannelMembers = useCallback(async () => {
    if (!activeChannel || isDm) {
      setChannelMembers([]);
      return;
    }
    try {
      const members = await dbService.fetchChannelMembers(activeChannel);
      if (Array.isArray(members)) {
        setChannelMembers(members);
      }
    } catch (err) {
      console.warn('Channel members fetch warning:', err);
    }
  }, [activeChannel, isDm]);

  // Optimistically append newly added member so UI flips from "Ekle" to "Üye" immediately
  const handleMemberAdded = useCallback((addedFriend, insertedRow = null) => {
    if (activeChannel && !isDm && addedFriend?.id) {
      const friendId = String(addedFriend.id);
      setChannelMembers((prev) => {
        const existing = Array.isArray(prev) ? prev : [];
        if (existing.some((m) => String(m.user_id || m.id) === friendId)) {
          return existing;
        }
        const resolvedName = addedFriend.name || addedFriend.display_name || addedFriend.username || 'Kullanıcı';
        const resolvedAvatar = addedFriend.avatar || addedFriend.avatar_url || '';
        const resolvedStatus = addedFriend.status || 'offline';
        const profilePayload = {
          id: addedFriend.id,
          username: addedFriend.username || 'user',
          display_name: resolvedName,
          avatar_url: resolvedAvatar,
          status: resolvedStatus,
          substatus: addedFriend.substatus || '',
          game: addedFriend.game || null,
        };
        return [
          ...existing,
          {
            ...(insertedRow && typeof insertedRow === 'object' ? insertedRow : {}),
            id: insertedRow?.id || `mem-${activeChannel}-${friendId}`,
            channel_id: activeChannel,
            user_id: addedFriend.id,
            role: insertedRow?.role || 'member',
            name: resolvedName,
            username: profilePayload.username,
            avatar: resolvedAvatar || null,
            avatar_url: resolvedAvatar || null,
            game: profilePayload.game || '',
            substatus: profilePayload.substatus || '',
            status: resolvedStatus,
            profile: profilePayload,
            profiles: profilePayload,
          },
        ];
      });
    }
    loadChannelMembers();
  }, [activeChannel, isDm, loadChannelMembers]);

  useEffect(() => {
    let cancelled = false;

    const fetchMembers = async () => {
      if (!activeChannel || isDm) {
        if (!cancelled) setChannelMembers([]);
        return;
      }
      try {
        const members = await dbService.fetchChannelMembers(activeChannel);
        if (!cancelled && Array.isArray(members)) {
          setChannelMembers(members);
        }
      } catch (err) {
        console.warn('Channel members fetch warning:', err);
      }
    };

    fetchMembers();

    const unsubChannelMembers = dbService.subscribeToTable('channel_members', () => {
      fetchMembers();
    });
    const unsubProfilesChannel = dbService.subscribeToTable('profiles', () => {
      fetchMembers();
    });

    return () => {
      cancelled = true;
      unsubChannelMembers?.();
      unsubProfilesChannel?.();
    };
  }, [activeChannel, isDm]);

  // Compute live channel members with real-time presences merged
  const liveChannelMembers = useMemo(() => {
    return (channelMembers || []).map((m) => {
      const memberId = m.user_id || m.id;
      const isSelf = memberId === activeUserProfile?.id;
      const p = presences[memberId];
      const profile = m.profiles || {};
      const status = isSelf
        ? (activeUserProfile?.status || 'online')
        : (p && p.status !== 'offline' && p.status !== 'invisible' && p.isOnline !== false ? (p?.status || 'online') : 'offline');
      const isOnline = isSelf
        ? (status !== 'offline' && status !== 'invisible')
        : Boolean(p && p.status !== 'offline' && p.status !== 'invisible' && p.isOnline !== false);

      return {
        id: memberId,
        user_id: memberId,
        name: isSelf
          ? pickDisplayName([activeUserProfile?.name, activeUserProfile?.display_name, activeUserProfile?.username], 'Sen (You)')
          : pickDisplayName([p?.name, p?.display_name, p?.username, profile.display_name, profile.username, m.name], 'Kullanıcı'),
        avatar: isSelf
          ? (activeUserProfile?.avatar || activeUserProfile?.avatar_url)
          : (p?.avatar || profile.avatar_url || profile.avatar || m.avatar || ''),
        game: isOnline ? (isSelf ? activeUserProfile?.game : (p?.game !== undefined ? p.game : (profile.game || m.game))) : null,
        substatus: isOnline ? (isSelf ? activeUserProfile?.substatus : (p?.substatus !== undefined ? p.substatus : (profile.substatus || m.substatus))) : '',
        status,
        isOnline,
        role: m.role || 'member',
      };
    });
  }, [channelMembers, presences, activeUserProfile]);

  // Fetch recipient profile for DM if not in friends list yet
  const [dmUserProfile, setDmUserProfile] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!isDm || !activeDmUserId) return;

    dbService.fetchUserProfile(activeDmUserId).then((prof) => {
      if (!cancelled && prof) {
        setDmUserProfile(prof);
      }
    }).catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isDm, activeDmUserId, currentUserId]);

  // Compute dynamic friends list with real-time presences merged
  const friends = useMemo(() => {
    return (friendshipsData.friends || []).map((f) => {
      const p = presences[f.id];
      const fallbackProf = dmUserProfile?.id === f.id ? dmUserProfile : null;
      const cachedProf = getCachedUserProfile(f.id);
      const pAvatar = (p?.avatar && typeof p.avatar === 'string' && p.avatar.trim()) ? p.avatar.trim() : null;
      const fallbackAv = (fallbackProf && (fallbackProf.avatar_url || fallbackProf.avatar)) || null;
      const cachedAv = cachedProf?.avatar_url || cachedProf?.avatar || null;
      const fAvatar = (f.avatar || f.avatar_url || '').trim?.() || (f.avatar || f.avatar_url || '');
      const resolvedAv = pAvatar || fallbackAv || fAvatar || cachedAv || '';

      // A friend is strictly online ONLY if active presence is confirmed and not offline/invisible
      const isFriendOnline = Boolean(
        p &&
        p.status &&
        p.status !== 'offline' &&
        p.status !== 'invisible' &&
        p.isOnline !== false
      );

      const resolvedName = pickDisplayName(
        [
          isFriendOnline ? p?.name : null,
          isFriendOnline ? p?.display_name : null,
          f.name,
          f.display_name,
          fallbackProf?.display_name,
          fallbackProf?.name,
          p?.name,
          p?.display_name,
          f.username,
          cachedProf?.display_name,
          cachedProf?.name,
          cachedProf?.username,
        ],
        'Kullanıcı'
      );

      if (!isFriendOnline) {
        return {
          ...f,
          name: resolvedName,
          display_name: resolvedName,
          avatar: resolvedAv,
          avatar_url: resolvedAv,
          status: 'offline',
          isOnline: false,
          isAway: false,
          game: null,
          substatus: '',
        };
      }

      return {
        ...f,
        name: resolvedName,
        display_name: resolvedName,
        avatar: resolvedAv,
        avatar_url: resolvedAv,
        game: p.game || null,
        substatus: p.substatus || f.substatus || '',
        status: p.status || 'online',
        isAway: p.status === 'idle' || !!p.isAway,
        isOnline: true,
      };
    });
  }, [friendshipsData.friends, presences, dmUserProfile]);

  const activeDmFriend = useMemo(() => {
    if (!isDm || !activeDmUserId) return null;
    const found = friends.find((f) => f.id === activeDmUserId);
    const fallbackProfile = dmUserProfile?.id === activeDmUserId ? dmUserProfile : null;
    const cachedProfile = getCachedUserProfile(activeDmUserId);
    const p = presences[activeDmUserId];
    const isTargetOnline = Boolean(
      p &&
      p.status &&
      p.status !== 'offline' &&
      p.status !== 'invisible' &&
      p.isOnline !== false
    );

    const resolvedName = pickDisplayName(
      [
        found?.name,
        found?.display_name,
        fallbackProfile?.display_name,
        fallbackProfile?.name,
        p?.name,
        p?.display_name,
        found?.username,
        fallbackProfile?.username,
        p?.username,
        cachedProfile?.display_name,
        cachedProfile?.name,
        cachedProfile?.username,
      ],
      'Kullanıcı'
    );

    const resolvedUsername =
      [found?.username, fallbackProfile?.username, p?.username, cachedProfile?.username].find(
        (u) => typeof u === 'string' && u.trim() && !isUuidLike(u)
      ) || '';

    const base = found || fallbackProfile || cachedProfile || {
      id: activeDmUserId,
      name: resolvedName,
      display_name: resolvedName,
      username: resolvedUsername,
      game: null,
      substatus: '',
      status: 'offline',
      isOnline: false,
    };

    const pAvatar = (p?.avatar && typeof p.avatar === 'string' && p.avatar.trim()) ? p.avatar.trim() : null;
    const finalAvatar =
      pAvatar ||
      base.avatar ||
      base.avatar_url ||
      fallbackProfile?.avatar ||
      fallbackProfile?.avatar_url ||
      cachedProfile?.avatar ||
      cachedProfile?.avatar_url ||
      '';

    return {
      ...base,
      id: activeDmUserId,
      name: resolvedName,
      display_name: resolvedName,
      username: resolvedUsername || base.username || '',
      avatar: finalAvatar,
      avatar_url: finalAvatar,
      status: isTargetOnline ? (p?.status || 'online') : 'offline',
      isOnline: isTargetOnline,
      isAway: isTargetOnline && (p?.status === 'idle' || !!p?.isAway),
      game: isTargetOnline ? (p?.game || null) : null,
      substatus: isTargetOnline ? (p?.substatus || base.substatus || '') : '',
    };
  }, [isDm, activeDmUserId, friends, presences, dmUserProfile]);

  // WebRTC Mesh Voice Hook
  const {
    isConnected,
    isMuted,
    isDeafened,
    isSpeaking,
    isScreenSharing,
    activeScreenShare,
    myPeerId,
    remotePeers,
    peerMetadata,
    peerLatencies,
    myPing,
    audioError,
    connectVoice,
    disconnectVoice,
    toggleMute,
    setMuted,
    toggleDeafen,
    callPeer,
    switchVoiceRoom,
    stopScreenShare,
    toggleScreenShare,
  } = useVoiceWebRTC();

  // Active In-Chat Voice Calls State across all channels & DMs (Steam-style joinable session)
  // Format: { [channelId]: { active: boolean, stage: 'active', count: number, initiator: any, members: any[] } }
  const [channelCalls, setChannelCalls] = useState({});
  const [activeCallChannelId, setActiveCallChannelId] = useState(null);

  // Sync real-time in-chat voice calls (Steam-style joinable voice sessions)
  useEffect(() => {
    const handleCallStatus = (data) => {
      if (!data?.channelId) return;

      // Voice chat session ended or all participants left
      if (!data.active || (data.count === 0 && (!data.members || data.members.length === 0))) {
        setChannelCalls((prev) => {
          const next = { ...prev };
          delete next[data.channelId];
          return next;
        });

        if (activeCallChannelId === data.channelId) {
          disconnectVoice();
          setActiveCallChannelId(null);
        }
        return;
      }

      // Voice chat is actively joinable
      setChannelCalls((prev) => ({
        ...prev,
        [data.channelId]: {
          active: true,
          stage: 'active',
          channelId: data.channelId,
          initiator: data.initiator,
          targetUserId: data.targetUserId,
          targetUser: data.targetUser,
          count: data.count || (data.members?.length) || 1,
          members: data.members || (data.initiator ? [data.initiator] : []),
        },
      }));
    };

    chatService.on('call_status', handleCallStatus);
    return () => {
      chatService.off('call_status', handleCallStatus);
    };
  }, [activeUserProfile?.id, activeCallChannelId, disconnectVoice]);

  // Fetch only channels where the active user is an explicit member and subscribe to realtime updates
  useEffect(() => {
    let cancelled = false;
    const cacheKey = getUserChannelsCacheKey(currentUserId);

    if (isSupabaseConfigured) {
      try {
        localStorage.removeItem('standupp_text_channels');
        localStorage.removeItem('standupp_db_channels');
      } catch {}
    }

    async function loadDbChannels() {
      if (!currentUserId) {
        if (!cancelled) {
          setTextChannels([]);
          setIsChannelsLoading(false);
        }
        return;
      }

      try {
        const dbChans = await dbService.fetchChannels(currentUserId);
        if (!cancelled && Array.isArray(dbChans)) {
          const texts = dbChans
            .filter((c) => c && c.type !== 'voice' && c.id !== 'home' && !c.is_home)
            .map((c) => ({
              ...c,
              avatar: c.avatar_url || c.avatar || '',
              avatar_url: c.avatar_url || c.avatar || '',
            }));
          setTextChannels(texts);
          if (cacheKey) {
            try {
              localStorage.setItem(cacheKey, JSON.stringify(texts));
            } catch {}
          }
        }
      } catch (err) {
        console.warn('Channel fetch warning:', err);
      } finally {
        if (!cancelled) {
          setIsChannelsLoading(false);
        }
      }
    }

    loadDbChannels();

    const unsubChannels = dbService.subscribeToTable('channels', (payload) => {
      if (payload?.eventType === 'DELETE' || (!payload?.new && payload?.old)) {
        const deletedId = payload?.old?.id || payload?.id;
        if (deletedId) {
          const cleanId = String(deletedId).replace(/^text-/, '');
          const targetIds = [deletedId, cleanId, `text-${cleanId}`];
          setTextChannels((prev) => prev.filter((c) => c && !targetIds.includes(c.id)));
        }
        return;
      }
      // Update metadata (name, avatar, etc.) only for channels the user is already a member of
      if (payload?.eventType === 'UPDATE' && payload?.new) {
        const updatedChan = payload.new;
        if (updatedChan && updatedChan.type !== 'voice' && updatedChan.id !== 'home' && !updatedChan.is_home) {
          const normalizedChan = {
            ...updatedChan,
            avatar: updatedChan.avatar_url || updatedChan.avatar || '',
            avatar_url: updatedChan.avatar_url || updatedChan.avatar || '',
          };
          setTextChannels((prev) => {
            if (!prev.some((c) => c.id === normalizedChan.id)) return prev;
            return prev.map((c) => (c.id === normalizedChan.id ? { ...c, ...normalizedChan } : c));
          });
        }
      }
    });

    // React immediately when current user is added to or removed from a group
    const unsubChannelMemberships = dbService.subscribeToTable('channel_members', (payload) => {
      if (!currentUserId) return;
      if (payload?.eventType === 'DELETE') {
        if (!payload?.old?.user_id || payload.old.user_id === currentUserId) {
          loadDbChannels();
        }
        return;
      }
      if (payload?.new?.user_id === currentUserId) {
        loadDbChannels();
      }
    });

    return () => {
      cancelled = true;
      unsubChannels?.();
      unsubChannelMemberships?.();
    };
  }, [currentUserId]);

  // Save channels to per-user localStorage cache
  useEffect(() => {
    const cacheKey = getUserChannelsCacheKey(currentUserId);
    if (!cacheKey) return;
    try {
      localStorage.setItem(cacheKey, JSON.stringify(textChannels));
    } catch {}
  }, [textChannels, currentUserId]);

  // Monitor network connection (online / offline)
  useEffect(() => {
    const handleOnline = () => {
      toast.success('Ağ Bağlantısı Kuruldu', {
        description: 'Tekrar çevrimiçi oldunuz.',
      });
    };
    const handleOffline = () => {
      toast.error('Bağlantı Kesildi!', {
        description: 'İnternet veya yerel ağ bağlantınız koptu.',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Push-to-Talk (PTT) Synchronization with WebRTC Audio Stream
  useEffect(() => {
    if (inputMode === 'ptt' && isConnected) {
      if (isPttActive) {
        if (isMuted && !isDeafened) {
          setMuted(false, true);
        }
      } else {
        if (!isMuted) {
          setMuted(true, true);
        }
      }
    }
  }, [inputMode, isConnected, isPttActive, isMuted, isDeafened, setMuted]);

  // Initial mute state when toggling between PTT and Open Mic
  useEffect(() => {
    if (isConnected) {
      if (inputMode === 'ptt') {
        setMuted(true);
      } else {
        setMuted(false);
      }
    }
  }, [inputMode, isConnected, setMuted]);

  // Isolated Realtime Chat Hook for the active channel or DM room
  const {
    messages,
    sendMessage,
    toggleReaction,
    setTyping,
    typingUsers,
    clearMessages,
  } = useRealtimeChat(activeChannel, activeUserProfile);

  // Automatically send read receipt when viewing a DM
  useEffect(() => {
    if (isDm && activeChannel && activeDmFriend?.id && activeUserProfile?.id) {
      chatService.sendReadReceipt(activeChannel, activeUserProfile.id);
    }
  }, [isDm, activeChannel, activeDmFriend?.id, activeUserProfile?.id, messages?.length]);

  const handleClearActiveChat = useCallback(async () => {
    try {
      if (isDm && activeDmFriend?.id && activeUserProfile?.id) {
        const roomId = getDmRoomId(activeUserProfile.id, activeDmFriend.id);
        await dbService.deleteChatMessages(roomId, null);
      } else if (activeChannel) {
        await dbService.deleteChatMessages(null, activeChannel);
      }
      clearMessages?.(activeChannel);
      try {
        localStorage.removeItem('standupp_cached_messages');
      } catch {}
    } catch (err) {
      console.error('handleClearActiveChat error:', err);
      throw err;
    }
  }, [isDm, activeDmFriend, activeUserProfile, activeChannel, clearMessages]);

  // UI State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [_isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');



  // Modals State
  const [modalOpen, setModalOpen] = useState(false);
  const [peerModalOpen, setPeerModalOpen] = useState(false);

  // Steam-style in-chat voice call start / join (instantly connected, no ringing)
  const handleStartCall = useCallback(async (targetChannelId = activeChannel) => {
    try {
      sounds.playJoin();
      const callRoom = `standupp-call-${targetChannelId}`;
      switchVoiceRoom(callRoom);
      await connectVoice(null, activeUserProfile.name, activeUserProfile);
      setActiveCallChannelId(targetChannelId);

      const targetFriend = isDm ? activeDmFriend : null;

      setChannelCalls((prev) => {
        const currentCall = prev[targetChannelId];
        const updatedMembers = [
          ...(currentCall?.members || []).filter((m) => m.id !== activeUserProfile.id),
          activeUserProfile,
        ];
        const updated = {
          ...prev,
          [targetChannelId]: {
            channelId: targetChannelId,
            active: true,
            stage: 'active',
            initiator: currentCall?.initiator || activeUserProfile,
            targetUserId: isDm ? activeDmUserId : null,
            targetUser: targetFriend,
            count: updatedMembers.length,
            members: updatedMembers,
          },
        };
        chatService.sendCallUpdate(updated[targetChannelId]);
        return updated;
      });
    } catch (err) {
      console.warn('Call start error:', err);
    }
  }, [activeChannel, switchVoiceRoom, connectVoice, activeUserProfile, isDm, activeDmUserId, activeDmFriend]);

  // Handle in-chat voice call leave / disconnect
  const handleLeaveCall = useCallback(() => {
    sounds.playLeave();
    const leavingChan = activeCallChannelId || activeChannel;
    disconnectVoice();
    setActiveCallChannelId(null);

    setChannelCalls((prev) => {
      const currentCall = prev[leavingChan];
      const remainingMembers = (currentCall?.members || []).filter(
        (m) => m.id !== activeUserProfile.id
      );
      if (remainingMembers.length === 0) {
        const next = { ...prev };
        delete next[leavingChan];
        chatService.sendCallUpdate({
          channelId: leavingChan,
          active: false,
          stage: 'ended',
          count: 0,
          members: [],
        });
        return next;
      } else {
        const updated = {
          ...currentCall,
          active: true,
          stage: 'active',
          count: remainingMembers.length,
          members: remainingMembers,
        };
        chatService.sendCallUpdate(updated);
        return {
          ...prev,
          [leavingChan]: updated,
        };
      }
    });
  }, [activeCallChannelId, activeChannel, disconnectVoice, activeUserProfile]);

  // Logout handler from within the application
  const handleLogout = useCallback(async () => {
    setIsLogoutModalOpen(false);
    if (activeCallChannelId && isConnected) {
      handleLeaveCall();
    }
    await logout();
  }, [activeCallChannelId, isConnected, handleLeaveCall, logout]);

  // Voice Members State with Current Authenticated User & Mesh Peers (with resolved real profiles)
  const voiceMembers = useMemo(() => {
    const knownProfiles = [
      ...(activeCallChannelId && channelCalls[activeCallChannelId]?.members
        ? channelCalls[activeCallChannelId].members
        : []),
      ...(liveChannelMembers || []),
      ...(friends || []),
      ...(isDm && activeDmFriend ? [activeDmFriend] : []),
      ...(dmUserProfile ? [dmUserProfile] : []),
      ...Object.values(presences || {}),
    ];

    const nonSelfCallMembers = (activeCallChannelId && channelCalls[activeCallChannelId]?.members
      ? channelCalls[activeCallChannelId].members
      : []
    ).filter((m) => m && m.id && m.id !== activeUserProfile.id);

    // Union of active audio-streaming peers and presence/metadata-discovered peers
    const remotePeerMap = new Map();
    remotePeers.forEach((p) => {
      if (p?.peerId && p.peerId !== myPeerId) {
        remotePeerMap.set(p.peerId, p);
      }
    });
    Object.keys(peerMetadata || {}).forEach((peerId) => {
      if (peerId && peerId !== myPeerId && !remotePeerMap.has(peerId)) {
        remotePeerMap.set(peerId, { peerId, stream: null, isSpeaking: false });
      }
    });

    const uniqueRemotePeers = Array.from(remotePeerMap.values());

    const resolvedRemotes = uniqueRemotePeers
      .map(({ peerId, isSpeaking: peerSpeaking }) => {
        const meta = peerMetadata?.[peerId] || {};

        // Avoid showing own stale peer entry
        if (meta.userId && activeUserProfile?.id && meta.userId === activeUserProfile.id) {
          return null;
        }

        let matchedProfile = null;
        if (meta.userId) {
          matchedProfile =
            presences?.[meta.userId] ||
            knownProfiles.find((p) => p && (p.id === meta.userId || p.user_id === meta.userId));
        }

        if (!matchedProfile && (meta.name || meta.userName)) {
          const targetName = (meta.name || meta.userName).trim().toLowerCase();
          matchedProfile = knownProfiles.find(
            (p) =>
              p &&
              ((p.display_name || '').trim().toLowerCase() === targetName ||
                (p.name || '').trim().toLowerCase() === targetName ||
                (p.username || '').trim().toLowerCase() === targetName)
          );
        }

        // 1-on-1 call fallback (e.g. before metadata finishes arriving over network)
        if (!matchedProfile && uniqueRemotePeers.length === 1) {
          if (isDm && activeDmFriend) {
            matchedProfile = activeDmFriend;
          } else if (nonSelfCallMembers.length === 1) {
            matchedProfile = nonSelfCallMembers[0];
          }
        }

        const resolvedName = pickDisplayName(
          [
            matchedProfile?.display_name,
            matchedProfile?.name,
            matchedProfile?.username,
            meta.name,
            meta.userName,
          ],
          `Katılımcı-${peerId.slice(0, 5)}`
        );

        const resolvedAvatar =
          matchedProfile?.avatar_url ||
          matchedProfile?.avatar ||
          meta.avatar ||
          null;

        const resolvedId = matchedProfile?.id || matchedProfile?.userId || meta.userId || peerId;

        return {
          id: resolvedId,
          peerId: peerId,
          name: resolvedName,
          avatar: resolvedAvatar,
          avatar_url: resolvedAvatar,
          avatarBg: '#1e3a5f',
          isSpeaking: Boolean(peerSpeaking),
          status: matchedProfile?.status || 'online',
          game: matchedProfile?.game || '',
          substatus: matchedProfile?.substatus || 'Seste',
          statusColor: 'text-[#57cbde]',
          isAway: matchedProfile?.status === 'idle',
          ping: peerLatencies[peerId] || myPing || 28,
        };
      })
      .filter(Boolean);

    return [
      ...(isConnected
        ? [
            {
              id: activeUserProfile.id,
              name: activeUserProfile.name,
              avatar: activeUserProfile.avatar || null,
              avatarBg: '#3d9921',
              isSpeaking: isSpeaking,
              status: activeUserProfile.status || 'online',
              game: activeUserProfile.game || '',
              substatus: activeUserProfile.substatus || (isMuted ? 'Mikrofon Susturuldu' : 'Bağlı (Mesh RTC)'),
              statusColor: activeUserProfile.game ? 'text-[#8fcd51]' : 'text-[#57cbde]',
              isAway: activeUserProfile.status === 'idle',
              ping: myPing || 24,
            },
          ]
        : []),
      ...resolvedRemotes,
    ];
  }, [
    isConnected,
    activeUserProfile,
    isSpeaking,
    isMuted,
    myPing,
    remotePeers,
    peerMetadata,
    myPeerId,
    peerLatencies,
    activeCallChannelId,
    channelCalls,
    liveChannelMembers,
    friends,
    isDm,
    activeDmFriend,
    dmUserProfile,
    presences,
  ]);

  // Per-user audio volume & local mute preferences persisted in localStorage
  const [peerAudioPrefs, setPeerAudioPrefs] = useState(() => {
    try {
      const saved = localStorage.getItem('voys_peer_audio_prefs');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const handleSetPeerVolume = useCallback((member, volumePercent) => {
    const keys = [member?.id, member?.peerId].filter(Boolean).map(String);
    if (keys.length === 0) return;
    const clamped = Math.max(0, Math.min(100, Math.round(Number(volumePercent) || 0)));

    setPeerAudioPrefs((prev) => {
      const next = { ...prev };
      keys.forEach((k) => {
        next[k] = {
          volume: clamped,
          muted: clamped === 0,
        };
      });
      try {
        localStorage.setItem('voys_peer_audio_prefs', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const handleTogglePeerMute = useCallback((member) => {
    const keys = [member?.id, member?.peerId].filter(Boolean).map(String);
    if (keys.length === 0) return;

    setPeerAudioPrefs((prev) => {
      const existing = keys.map((k) => prev[k]).find(Boolean) || { volume: 100, muted: false };
      const nextMuted = !existing.muted;
      const nextVol = !nextMuted && existing.volume === 0 ? 100 : (existing.volume ?? 100);
      const next = { ...prev };
      keys.forEach((k) => {
        next[k] = {
          volume: nextVol,
          muted: nextMuted,
        };
      });
      try {
        localStorage.setItem('voys_peer_audio_prefs', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // Resolve active WebRTC peerId -> audio volume/mute preference
  const peerAudioMap = useMemo(() => {
    const map = {};
    voiceMembers.forEach((m) => {
      if (!m?.peerId) return;
      const pref = peerAudioPrefs[String(m.id)] || peerAudioPrefs[String(m.peerId)];
      if (pref) {
        map[m.peerId] = pref;
      }
    });
    return map;
  }, [voiceMembers, peerAudioPrefs]);

  // Channel Creation Handler with database persistence
  const handleCreateChannel = async ({ name, members = [] }) => {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9ığüşöçİĞÜŞÖÇ]/gi, '-')
      .replace(/-+/g, '-');
    
    const channelId = `text-${slug || Date.now().toString(36)}`;
    const newChan = { 
      id: channelId, 
      name, 
      type: 'text', 
      is_home: false,
      created_by: user?.id || null 
    };

    setTextChannels((prev) => (prev.some((c) => c.id === newChan.id) ? prev : [...prev, newChan]));

    // Persist to database
    try {
      await dbService.createChannel(newChan);
      if (user?.id) {
        await dbService.addChannelMember(channelId, user.id, 'admin').catch(() => {});
      }
      if (Array.isArray(members) && members.length > 0) {
        for (const memberId of members) {
          await dbService.addChannelMember(channelId, memberId, 'member').catch(() => {});
        }
      }
    } catch (err) {
      console.warn('DB channel create error:', err);
    }

    toast.success('Grup Oluşturuldu', {
      description: `"${name}" grubu aktif edildi.`,
    });

    navigate(`/channel/${channelId}`);
  };

  const handleUpdateChannel = useCallback(async (channelId, updates) => {
    try {
      const normalizedAvatar = updates.avatar_url !== undefined ? updates.avatar_url : updates.avatar;
      setTextChannels((prev) => {
        const next = prev.map((c) => {
          if (c.id !== channelId) return c;
          return {
            ...c,
            ...updates,
            ...(normalizedAvatar !== undefined ? { avatar: normalizedAvatar, avatar_url: normalizedAvatar } : {}),
          };
        });
        const cacheKey = getUserChannelsCacheKey(currentUserId);
        if (cacheKey) {
          try {
            localStorage.setItem(cacheKey, JSON.stringify(next));
          } catch {}
        }
        return next;
      });
      await dbService.updateChannel(channelId, updates);
    } catch (err) {
      console.warn('Update channel error:', err);
    }
  }, [currentUserId]);

  const handleDeleteChannel = useCallback(async (channelId) => {
    if (!channelId) return;
    try {
      const cleanId = String(channelId).replace(/^text-/, '');
      const targetIds = [channelId, cleanId, `text-${cleanId}`];

      setTextChannels((prev) => {
        const next = prev.filter((c) => c && !targetIds.includes(c.id));
        const cacheKey = getUserChannelsCacheKey(currentUserId);
        if (cacheKey) {
          try {
            localStorage.setItem(cacheKey, JSON.stringify(next));
          } catch {}
        }
        return next;
      });

      await dbService.deleteChannel(channelId);

      if (activeCallChannelId && targetIds.includes(activeCallChannelId)) {
        disconnectVoice();
        setActiveCallChannelId(null);
      }

      navigate('/', { replace: true });
    } catch (err) {
      console.error('Delete channel error:', err);
      throw err;
    }
  }, [activeCallChannelId, currentUserId, disconnectVoice, navigate]);

  const handleSelectChannel = (channelId) => {
    navigate(`/channel/${channelId}`);
  };

  const handleSelectDm = (friendId) => {
    navigate(`/dm/${friendId}`);
  };

  const handleBackToChannels = () => {
    navigate('/');
  };

  // Auto-redirect only after membership load: stay on '/' if 0 channels, and guard unjoined '/channel/:id' URLs
  useEffect(() => {
    if (isChannelsLoading || !currentUserId) return;
    if (location.pathname === '/' || location.pathname === '/channel/home') {
      if (textChannels.length > 0) {
        navigate(`/channel/${textChannels[0].id}`, { replace: true });
      }
      return;
    }
    if (pathParts[1] === 'channel' && pathParts[2] && pathParts[2] !== 'home' && !matchedChannel) {
      if (activeCallChannelId === pathParts[2]) {
        queueMicrotask(() => {
          disconnectVoice();
          setActiveCallChannelId(null);
        });
      }
      navigate(textChannels.length > 0 ? `/channel/${textChannels[0].id}` : '/', { replace: true });
    }
  }, [
    isChannelsLoading,
    currentUserId,
    location.pathname,
    pathParts,
    matchedChannel,
    textChannels,
    navigate,
    activeCallChannelId,
    disconnectVoice,
  ]);

  // Check if active channel or DM actually exists (membership verified)
  const channelExists = isDm
    ? Boolean(activeDmFriend || activeDmUserId)
    : Boolean(matchedChannel);

  // Current page title shown at the center of top WindowHeader
  const currentPageTitle = useMemo(() => {
    if (isDm) {
      return 'Mesajlar';
    }
    if (pathParts[1] === 'channel') {
      if (!pathParts[2] || pathParts[2] === 'home') {
        return 'Ana Sayfa';
      }
      if (matchedChannel?.name) {
        return matchedChannel.name;
      }
      return pathParts[2].replace(/^text-/, '');
    }
    return 'Ana Sayfa';
  }, [isDm, pathParts, matchedChannel]);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#101214] voys-glass-app rounded-2xl border border-white/10 overflow-hidden select-none">
      {/* Hidden remote <audio autoPlay> tags managed within React component */}
      <RemoteAudioPlayers 
        remotePeers={remotePeers} 
        isDeafened={isDeafened} 
        volume={outputVolume / 100}
        peerAudioMap={peerAudioMap}
        sinkId={selectedAudioOutput}
      />

      {/* Top Window Bar & Header */}
      <WindowHeader 
        pageTitle={currentPageTitle}
      />

      {/* Audio permission notice if mic access requires interaction */}
      {audioError && isConnected && (
        <div className="bg-amber-950/40 border-b border-amber-500/20 px-4 py-2 text-xs text-amber-300 flex items-center justify-between select-none backdrop-blur-md">
          <span>{audioError}</span>
          <button 
            type="button" 
            onClick={() => connectVoice(null, activeUserProfile.name, activeUserProfile)} 
            className="underline font-bold hover:text-white transition"
          >
            İzin Ver / Yeniden Dene
          </button>
        </div>
      )}

      {/* Main App Workspace: Sidebar + Voice Stage/Chat */}
      <div className="flex flex-1 min-h-0 relative bg-transparent overflow-hidden">
        {/* Left Sidebar: Unified Direct Messages & Channels */}
        <Sidebar
          textChannels={textChannels}
          channelCalls={channelCalls}
          friends={friends}
          incomingRequestsCount={friendshipsData.incoming?.length || 0}
          incomingRequests={friendshipsData.incoming || []}
          outgoingRequests={friendshipsData.outgoing || []}
          onFriendshipUpdated={loadFriendships}
          currentUserId={currentUserId}
          onOpenAddFriend={() => setIsAddFriendModalOpen(true)}
          onOpenCreateChannel={() => setModalOpen(true)}
          onCreateChannel={handleCreateChannel}
          activeChannel={activeChannel}
          activeDmUserId={activeDmUserId}
          onSelectChannel={handleSelectChannel}
          onSelectDm={handleSelectDm}
          currentUserProfile={activeUserProfile}
          onOpenSettings={openSettings}
          onLogout={() => setIsLogoutModalOpen(true)}
          onUpdateStatus={handleUpdateStatus}
          activeMessages={messages}
        />

        {/* Column 3: Main Chat & In-Chat Voice Call Area */}
        <div className="flex-1 flex min-w-0 h-full relative overflow-hidden bg-transparent voys-glass-chat">
          <ChatArea
            activeChannel={activeChannel}
            channelData={matchedChannel}
            onUpdateChannel={handleUpdateChannel}
            onDeleteChannel={handleDeleteChannel}
            channelExists={channelExists}
            onOpenCreateChannel={() => setModalOpen(true)}
            onOpenAddMember={null}
            onOpenGroupAddMember={() => setIsAddMemberModalOpen(true)}
            friends={friends}
            onMemberAdded={handleMemberAdded}
            isDmMode={isDm}
            activeDmFriend={activeDmFriend}
            onBackToChannels={handleBackToChannels}
            onOpenSettings={openSettings}
            onClearChat={handleClearActiveChat}
            // Universal In-Chat Voice Call Props (Steam-style joinable session)
            isCallActive={Boolean(activeChannel && (channelCalls[activeChannel]?.active || (activeCallChannelId === activeChannel && isConnected)))}
            isInCall={Boolean(activeChannel && activeCallChannelId === activeChannel && isConnected)}
            callMembers={activeChannel && activeCallChannelId === activeChannel && isConnected ? voiceMembers : ((activeChannel && channelCalls[activeChannel]?.members) || [])}
            callState="active"
            isCaller={false}
            callInitiator={activeChannel ? channelCalls[activeChannel]?.initiator : null}
            targetUser={activeDmFriend}
            ringCount={1}
            maxRings={3}
            onCancelCall={handleLeaveCall}
            onAcceptCall={null}
            onDeclineCall={null}
            onStartCall={() => activeChannel && handleStartCall(activeChannel)}
            onLeaveCall={handleLeaveCall}
            onToggleDmCall={() => (activeChannel && activeCallChannelId === activeChannel && isConnected ? handleLeaveCall() : (activeChannel && handleStartCall(activeChannel)))}
            messages={messages}
            onSendMessage={sendMessage}
            onToggleReaction={toggleReaction}
            currentUser={activeUserProfile}
            channelMembers={liveChannelMembers}
            presences={presences}
            onTyping={setTyping}
            typingUsers={typingUsers}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
            // Screen Sharing
            activeScreenShare={activeScreenShare}
            onStopScreenShare={stopScreenShare}
            isScreenSharing={isScreenSharing}
            onToggleScreenShare={toggleScreenShare}
            // Voice Controls
            isConnected={isConnected}
            isMuted={isMuted}
            isDeafened={isDeafened}
            isSpeaking={isSpeaking}
            onToggleMute={toggleMute}
            onToggleDeafen={toggleDeafen}
            onDisconnect={handleLeaveCall}
            onConnect={() => handleStartCall(activeChannel)}
            peerAudioPrefs={peerAudioPrefs}
            onSetPeerVolume={handleSetPeerVolume}
            onTogglePeerMute={handleTogglePeerMute}
            onSelectDm={handleSelectDm}
          />
        </div>
      </div>



      {/* Create Channel Modal */}
      <CreateChannelModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreateChannel={handleCreateChannel}
      />

      {/* WebRTC PeerJS Connection Modal */}
      <PeerConnectModal
        isOpen={peerModalOpen}
        onClose={() => setPeerModalOpen(false)}
        myPeerId={myPeerId}
        connectedPeers={remotePeers.map((p) => p.peerId)}
        onCallPeer={callPeer}
      />

      {/* Stand.upp Settings & Audio Devices Modal */}
      <SettingsModal onLogout={() => setIsLogoutModalOpen(true)} />

      {/* Logout Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={handleLogout}
        userName={activeUserProfile?.name || 'Kullanıcı'}
      />

      {/* Add Friend / Friend Requests Modal */}
      <AddFriendModal
        isOpen={isAddFriendModalOpen}
        onClose={() => setIsAddFriendModalOpen(false)}
        currentUser={activeUserProfile}
        onFriendshipUpdated={loadFriendships}
        friends={friends}
        incomingRequests={friendshipsData.incoming}
        outgoingRequests={friendshipsData.outgoing}
      />

      {/* Add Member to Channel Modal */}
      <AddMemberModal
        isOpen={isAddMemberModalOpen}
        onClose={() => setIsAddMemberModalOpen(false)}
        activeChannel={activeChannel}
        channelName={
          activeChannel === 'home'
            ? 'Home'
            : (textChannels.find((c) => c.id === activeChannel)?.name ||
               (typeof activeChannel === 'string' ? activeChannel.replace(/^text-/, '') : 'Sohbet'))
        }
        channelType="text"
        friends={friends}
        currentMembers={channelMembers}
        onMemberAdded={handleMemberAdded}
      />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <Toaster
          theme="dark"
          richColors
          position="bottom-right"
          closeButton
          toastOptions={{ style: { zIndex: 9999 } }}
        />
        <Routes>
          {/* Public Auth Routes (Guest Only) */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <AuthPage initialMode="login" />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <AuthPage initialMode="register" />
              </PublicRoute>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <PublicRoute>
                <AuthPage initialMode="forgot" />
              </PublicRoute>
            }
          />
          <Route
            path="/reset-password"
            element={<AuthPage initialMode="reset" />}
          />

          {/* Protected Application Routes */}
          <Route 
            path="/channel/:channelId" 
            element={
              <ProtectedRoute>
                <StanduppApp />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dm/:userId" 
            element={
              <ProtectedRoute>
                <StanduppApp />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <StanduppApp />
              </ProtectedRoute>
            } 
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;
