import { createClient } from '@supabase/supabase-js';
import { compressAvatarImage } from '../utils/imageCompressor';
import { pickDisplayName, getCachedUserProfile, cacheUserProfiles, isUuidLike, getUserColor, CLASSIC_PURPLE } from '../utils/userDisplay';
import {
  normalizeParticipantId,
  parseDmRoomPair,
  getCanonicalDmRoomId,
  isDirectMessageForPair,
  resolveDirectMessagePartner,
  sanitizeDmMessagesList,
  sanitizeDmMessagesMap,
} from '../utils/dmIsolation';
import { isProtectedAdminIdentity, purgeUserFromStorage } from '../utils/userPurge';

// Retrieve environment variables from Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Verify if valid Supabase credentials are configured
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-project-id') &&
  !supabaseAnonKey.includes('your-anon-key-placeholder')
);

// Canonical Symmetric DM Room ID Helper (Ensures both participants share the exact same room_id)
export const getDmRoomId = (user1Id, user2Id) => getCanonicalDmRoomId(user1Id, user2Id);

// Timeout wrapper helper to prevent network requests from hanging indefinitely
export const withTimeout = (promise, ms = 25000, errorMsg = 'Sunucu yanıt vermedi (Zaman aşımı).') => {
  // Normalize arbitrary thenables (e.g. Supabase PostgrestFilterBuilder) into a real Promise
  // so .finally/.catch are always available and late rejections never leak unhandled.
  const settledPromise = Promise.resolve(promise);
  settledPromise.catch(() => {});

  let timer = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(errorMsg);
      err.name = 'TimeoutError';
      err.isNetworkOrTimeout = true;
      reject(err);
    }, ms);
  });

  return Promise.race([settledPromise, timeoutPromise]).finally(() => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  });
};

export const ADMIN_USER_ID = 'ba1e9bcb-ed19-4b81-8a29-2a8c89077f1a';
export const ADMIN_EMAIL = 'emirhantuzeniletisim@gmail.com';

export const isAuthorizedAdminUser = (user) =>
  Boolean(
    user &&
    user.id === ADMIN_USER_ID &&
    String(user.email || '').trim().toLowerCase() === ADMIN_EMAIL &&
    user.app_metadata?.role === 'admin'
  );

export const extractStoragePath = (publicUrl, bucketName) => {
  if (!publicUrl || typeof publicUrl !== 'string' || !bucketName) return null;
  if (publicUrl.startsWith('data:') || publicUrl.startsWith('blob:')) return null;
  const marker = `/storage/v1/object/public/${bucketName}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  const rawTail = publicUrl.slice(idx + marker.length).split('?')[0].split('#')[0];
  try {
    return decodeURIComponent(rawTail).replace(/^\/+/, '') || null;
  } catch {
    return rawTail.replace(/^\/+/, '') || null;
  }
};

const formatTimeHHMM = (msOrDate) => {
  if (!msOrDate) return '';
  const d = new Date(msOrDate);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

const mapDirectMessageRow = (row) => {
  const rawSentAt = row.sent_at ?? row.sentAt;
  const parsedSentAt = rawSentAt
    ? (typeof rawSentAt === 'number' ? rawSentAt : (!Number.isNaN(Number(rawSentAt)) ? Number(rawSentAt) : new Date(rawSentAt).getTime()))
    : (row.created_at ? new Date(row.created_at).getTime() : undefined);

  return {
    id: row.id,
    room_id: row.room_id,
    sender_id: row.sender_id,
    receiver_id: row.receiver_id,
    user: row.sender_name,
    userId: row.sender_id,
    avatar: row.sender_avatar || null,
    color: (row.color && row.color !== '#90ba3c' && row.color !== CLASSIC_PURPLE) ? row.color : getUserColor(row.sender_id || row.sender_name, false),
    hasCrown: row.has_crown || false,
    lines: Array.isArray(row.lines) ? row.lines : (row.lines ? [row.lines] : []),
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    parent_id: row.parent_id || null,
    reply_to: row.reply_to ? (typeof row.reply_to === 'string' ? JSON.parse(row.reply_to) : row.reply_to) : null,
    reactions: row.reactions ? (typeof row.reactions === 'string' ? JSON.parse(row.reactions) : row.reactions) : [],
    timestamp: row.timestamp_text || formatTimeHHMM(parsedSentAt),
    sentAt: parsedSentAt,
    sent_at: parsedSentAt,
    read_at: row.read_at ?? (row.read ? parsedSentAt : null),
    read: Boolean(row.read_at || row.read),
    delivered_at: row.delivered_at ?? null,
    created_at: row.created_at,
  };
};

async function unwrapFunctionError(error, fallbackMsg) {
  if (!error) return fallbackMsg;
  try {
    if (error.context && typeof error.context.clone === 'function') {
      const payload = await error.context.clone().json().catch(() => null);
      if (payload?.error) return payload.error;
    }
  } catch {}
  return error.message || fallbackMsg;
}

const isMissingRelationError = (err) => {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('schema cache')
  );
};

const createFriendshipError = (message, code) => {
  const err = new Error(message);
  if (code) err.code = code;
  return err;
};

const throwIfFriendshipConflict = (row, currentUserId) => {
  if (!row) return;
  const status = String(row.status || '').toLowerCase();
  if (status === 'accepted') {
    throw createFriendshipError('Bu kullanıcı ile zaten arkadaşsınız.', 'ALREADY_FRIENDS');
  }
  if (status === 'pending') {
    const isIncoming = row.friend_id === currentUserId || (row.receiver_id && row.receiver_id === currentUserId);
    if (isIncoming) {
      throw createFriendshipError(
        'Bu kullanıcı size zaten bir arkadaşlık isteği göndermiş. İstekler sekmesinden kabul edebilirsiniz.',
        'PENDING_INCOMING'
      );
    }
    throw createFriendshipError(
      'Bu kullanıcıya zaten bekleyen bir arkadaşlık isteği gönderdiniz.',
      'PENDING_OUTGOING'
    );
  }
  if (status === 'blocked') {
    throw createFriendshipError('Bu kullanıcıya şu anda arkadaşlık isteği gönderilemiyor.', 'BLOCKED');
  }
};

// Primary Supabase Client instance
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: {
        heartbeatIntervalMs: 15000,
        reconnectAfterMs: (tries) => [1000, 2000, 5000, 10000][Math.min(tries, 3)],
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : createClient(
      supabaseUrl || 'https://placeholder.supabase.co',
      supabaseAnonKey || 'placeholder-anon-key',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

// ==============================================================================
// Stand.upp Local Offline Engine (Used when Supabase is not configured or offline)
// ==============================================================================
class StanduppLocalEngine {
  constructor() {
    this.authListeners = [];
    this.tableSubscribers = new Map();
    this._dmCacheCleaned = false;
  }

  ensureCleanDmCache() {
    if (this._dmCacheCleaned) return;
    this._dmCacheCleaned = true;
    const raw = this.getItem('standupp_db_dm_msgs', {});
    const { cleanedMap, changed } = sanitizeDmMessagesMap(raw);
    if (changed) {
      this.setItem('standupp_db_dm_msgs', cleanedMap);
    }
  }

  getItem(key, fallback) {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : fallback;
    } catch {
      return fallback;
    }
  }

  setItem(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  getUsers() {
    return this.getItem('standupp_local_users', []);
  }

  saveUsers(users) {
    this.setItem('standupp_local_users', users);
  }

  getCurrentSession() {
    return this.getItem('standupp_local_session', null);
  }

  setCurrentSession(session) {
    this.setItem('standupp_local_session', session);
    this.notifyAuthChange(session ? 'SIGNED_IN' : 'SIGNED_OUT', session);
  }

  notifyAuthChange(event, session) {
    this.authListeners.forEach((cb) => {
      try {
        cb(event, session);
      } catch (err) {
        console.warn('Auth listener error:', err);
      }
    });
  }

  async signUp({ email = '', password, options = {} }) {
    await new Promise((r) => setTimeout(r, 150));
    const users = this.getUsers();
    const safeEmail = (email || '').trim().toLowerCase();
    const existing = users.find((u) => (u.email || '').toLowerCase() === safeEmail);

    if (existing) {
      return {
        data: { user: null, session: null },
        error: { message: 'Bu e-posta adresi ile kayıtlı bir kullanıcı zaten var.' },
      };
    }

    const emailPrefix = safeEmail ? safeEmail.split('@')[0] : 'kullanici';
    const cleanUsername = (options?.data?.username || emailPrefix).trim().toLowerCase().replace(/[^a-z0-9_]/g, '') || 'user';
    const displayName = options?.data?.display_name || options?.data?.username || emailPrefix;

    const newUser = {
      id: `user-${Date.now().toString(36)}`,
      email: safeEmail || `${emailPrefix}@standupp.local`,
      password,
      username: cleanUsername,
      display_name: displayName,
      avatar_url: options?.data?.avatar_url || '',
      game: '',
      substatus: 'Çevrimiçi',
      status: 'online',
      has_crown: false,
      created_at: new Date().toISOString(),
    };

    const updated = [...users, newUser];
    this.saveUsers(updated);

    const session = {
      user: newUser,
      access_token: `standupp-token-${Date.now()}`,
      expires_at: Date.now() + 3600 * 1000 * 24 * 7,
    };
    this.setCurrentSession(session);
    return { data: { user: newUser, session }, error: null };
  }

  async signInWithPassword({ email = '', password }) {
    await new Promise((r) => setTimeout(r, 150));
    const users = this.getUsers();
    const safeEmail = (email || '').trim().toLowerCase();
    let user = users.find(
      (u) => (u.email || '').toLowerCase() === safeEmail && (!u.password || u.password === password)
    );

    if (!user) {
      // Auto-create local profile for this email so user can immediately use offline mode
      const emailPrefix = safeEmail ? safeEmail.split('@')[0] : 'kullanici';
      user = {
        id: `local-${safeEmail.replace(/[^a-z0-9]/g, '') || Date.now().toString(36)}`,
        email: safeEmail,
        password: password,
        username: emailPrefix.replace(/[^a-z0-9_]/g, '') || 'kullanici',
        display_name: emailPrefix,
        name: emailPrefix,
        avatar_url: '',
        avatar: '',
        status: 'online',
        substatus: 'Çevrimiçi',
        created_at: new Date().toISOString(),
      };
      this.saveUsers([...users, user]);
    }

    const session = {
      user,
      access_token: `standupp-token-${Date.now()}`,
      expires_at: Date.now() + 3600 * 1000 * 24 * 7,
    };
    this.setCurrentSession(session);
    return { data: { user, session }, error: null };
  }

  async signOut() {
    this.setCurrentSession(null);
    return { error: null };
  }

  updateUser(userId, updates) {
    const users = this.getUsers();
    let updatedUser = null;
    const updatedUsers = users.map((u) => {
      if (u.id === userId) {
        updatedUser = { ...u, ...updates };
        return updatedUser;
      }
      return u;
    });
    if (updatedUsers.length > 0) {
      this.saveUsers(updatedUsers);
    }
    const session = this.getCurrentSession();
    if (session?.user?.id === userId) {
      const newSession = { ...session, user: { ...session.user, ...updates } };
      this.setCurrentSession(newSession);
    }
    this.notifyTable('profiles', { eventType: 'UPDATE', new: updatedUser || updates });
    return updatedUser || updates;
  }

  onAuthStateChange(callback) {
    this.authListeners.push(callback);
    const session = this.getCurrentSession();
    callback(session ? 'INITIAL_SESSION' : 'NO_SESSION', session);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this.authListeners = this.authListeners.filter((cb) => cb !== callback);
          },
        },
      },
    };
  }

  getChannels(userId = null) {
    const list = this.getItem('standupp_db_channels', []);
    const filtered = list.filter((c) => c && c.id !== 'home' && c.id !== 'voice-sesli-sohbet' && !c.is_home);
    if (!userId) return filtered;
    const members = this.getChannelMembers();
    const memberChanIds = new Set(
      members.filter((m) => m && m.user_id === userId).map((m) => m.channel_id)
    );
    return filtered.filter((c) => memberChanIds.has(c.id));
  }

  saveChannels(channels) {
    this.setItem('standupp_db_channels', channels);
    this.notifyTable('channels', { eventType: 'INSERT', new: channels });
  }

  addChannel(channel) {
    const list = this.getChannels();
    const updated = [...list, channel];
    this.saveChannels(updated);
    return channel;
  }

  updateChannel(channelId, updates) {
    const list = this.getChannels();
    let updatedChan = null;
    const updatedList = list.map((c) => {
      if (c && c.id === channelId) {
        updatedChan = { ...c, ...updates };
        return updatedChan;
      }
      return c;
    });
    this.saveChannels(updatedList);
    if (updatedChan) {
      this.notifyTable('channels', { eventType: 'UPDATE', new: updatedChan });
    }
    return updatedChan;
  }

  getChannelMessages(channelId) {
    const all = this.getItem('standupp_db_channel_msgs', {});
    const rawChan = String(channelId || '');
    const cleanChan = rawChan.replace(/^text-/, '');
    const list = all[rawChan] || all[cleanChan] || all[`text-${cleanChan}`] || [];
    const clearedAt = dbService?.getChannelClearedAt ? dbService.getChannelClearedAt(rawChan) : 0;
    if (clearedAt && Array.isArray(list)) {
      return list.filter((m) => {
        const t = Number(m?.sent_at ?? m?.sentAt) || (m?.created_at ? new Date(m.created_at).getTime() : 0);
        return !t || t > clearedAt;
      });
    }
    return list;
  }

  saveChannelMessages(channelId, messages) {
    const all = this.getItem('standupp_db_channel_msgs', {});
    const rawChan = String(channelId || '');
    const cleanChan = rawChan.replace(/^text-/, '');
    all[rawChan] = messages;
    all[cleanChan] = messages;
    all[`text-${cleanChan}`] = messages;
    this.setItem('standupp_db_channel_msgs', all);
  }

  addChannelMessage(channelId, message) {
    const all = this.getItem('standupp_db_channel_msgs', {});
    const list = all[channelId] || [];
    const updated = [...list, message];
    all[channelId] = updated;
    this.setItem('standupp_db_channel_msgs', all);
    this.notifyTable('channel_messages', { eventType: 'INSERT', new: message, channelId });
    return message;
  }

  getDmMessages(roomId, currentUserId = null) {
    this.ensureCleanDmCache();
    const all = this.getItem('standupp_db_dm_msgs', {});
    const pair = parseDmRoomPair(roomId);
    if (!pair) {
      return [];
    }
    const [u1, u2] = pair;
    const canonical = getCanonicalDmRoomId(u1, u2);
    const alt = `dm-${u2}--${u1}`;
    const combined = [
      ...(Array.isArray(all[canonical]) ? all[canonical] : []),
      ...(roomId !== canonical && Array.isArray(all[roomId]) ? all[roomId] : []),
      ...(alt !== canonical && alt !== roomId && Array.isArray(all[alt]) ? all[alt] : []),
    ];
    const seenIds = new Set();
    const deduped = combined.filter((msg) => {
      if (!msg?.id) return true;
      if (seenIds.has(msg.id)) return false;
      seenIds.add(msg.id);
      return true;
    });
    const sanitized = sanitizeDmMessagesList(deduped, u1, u2);
    if (currentUserId && dbService?.getDmClearedAt) {
      const partnerId = normalizeParticipantId(u1) === normalizeParticipantId(currentUserId) ? u2 : u1;
      const clearedAt = dbService.getDmClearedAt(currentUserId, canonical, partnerId);
      if (clearedAt) {
        return sanitized.filter((m) => {
          const t = Number(m?.sent_at ?? m?.sentAt) || (m?.created_at ? new Date(m.created_at).getTime() : 0);
          return t > clearedAt;
        });
      }
    }
    return sanitized;
  }

  saveDmMessages(roomId, messages) {
    this.ensureCleanDmCache();
    const pair = parseDmRoomPair(roomId);
    if (!pair) return;
    const canonical = getCanonicalDmRoomId(pair[0], pair[1]);
    const sanitized = sanitizeDmMessagesList(messages, pair[0], pair[1]);
    const all = this.getItem('standupp_db_dm_msgs', {});
    all[canonical] = sanitized;
    this.setItem('standupp_db_dm_msgs', all);
  }

  markDmRead(roomId, readerId, readAt = Date.now()) {
    this.ensureCleanDmCache();
    const pair = parseDmRoomPair(roomId);
    if (!pair) return;
    const canonical = getCanonicalDmRoomId(pair[0], pair[1]);
    const all = this.getItem('standupp_db_dm_msgs', {});
    const list = all[canonical];
    if (Array.isArray(list) && list.length > 0) {
      let changed = false;
      const updated = list.map((m) => {
        if (m && String(m.sender_id || m.userId) !== String(readerId) && !m.read_at) {
          changed = true;
          return { ...m, read_at: readAt, read: true, is_read: true };
        }
        return m;
      });
      if (changed) {
        all[canonical] = updated;
        this.setItem('standupp_db_dm_msgs', all);
      }
    }
  }

  addDmMessage(roomId, message) {
    this.ensureCleanDmCache();
    const pair = parseDmRoomPair(roomId);
    if (!pair) return message;
    const [u1, u2] = pair;
    const canonical = getCanonicalDmRoomId(u1, u2);
    if (!isDirectMessageForPair(message, u1, u2)) {
      return message;
    }
    const all = this.getItem('standupp_db_dm_msgs', {});
    const list = sanitizeDmMessagesList(all[canonical] || [], u1, u2);
    if (!message?.id || !list.some((m) => m?.id === message.id)) {
      all[canonical] = [...list, message];
      this.setItem('standupp_db_dm_msgs', all);
      this.notifyTable('direct_messages', { eventType: 'INSERT', new: message, roomId: canonical });
    }
    return message;
  }

  deleteDmMessages(roomId) {
    const all = this.getItem('standupp_db_dm_msgs', {});
    delete all[roomId];
    if (roomId && roomId.startsWith('dm-')) {
      const parts = roomId.replace(/^dm-/, '').split('--');
      if (parts.length === 2) {
        delete all[`dm-${parts[1]}--${parts[0]}`];
        delete all[`dm-${parts[0]}`];
        delete all[`dm-${parts[1]}`];
      }
    }
    this.setItem('standupp_db_dm_msgs', all);
    this.notifyTable('direct_messages', { eventType: 'DELETE', roomId });
  }

  deleteChannelMessages(channelId) {
    const all = this.getItem('standupp_db_channel_msgs', {});
    const rawChan = String(channelId || '');
    const cleanChan = rawChan.replace(/^text-/, '');
    const targetIds = Array.from(new Set([rawChan, cleanChan, `text-${cleanChan}`])).filter(Boolean);
    targetIds.forEach((id) => {
      delete all[id];
      try {
        localStorage.removeItem(`voys_cached_msgs_${id}`);
      } catch {}
    });
    this.setItem('standupp_db_channel_msgs', all);
    this.notifyTable('channel_messages', { eventType: 'DELETE', channelId: rawChan, targetIds });
  }

  deleteSingleDmMessage(roomId, messageId) {
    if (!messageId) return;
    const all = this.getItem('standupp_db_dm_msgs', {});
    const pair = parseDmRoomPair(roomId);
    const keysToCheck = new Set();
    if (pair) {
      const [u1, u2] = pair;
      keysToCheck.add(getCanonicalDmRoomId(u1, u2));
      keysToCheck.add(`dm-${u2}--${u1}`);
      keysToCheck.add(`dm-${u1}`);
      keysToCheck.add(`dm-${u2}`);
    }
    if (roomId) keysToCheck.add(roomId);

    let changed = false;
    keysToCheck.forEach((key) => {
      if (Array.isArray(all[key])) {
        const filtered = all[key].filter((m) => m?.id !== messageId);
        if (filtered.length !== all[key].length) {
          all[key] = filtered;
          changed = true;
        }
      }
    });

    if (changed) {
      this.setItem('standupp_db_dm_msgs', all);
      this.notifyTable('direct_messages', { eventType: 'DELETE', old: { id: messageId }, roomId });
    }
  }

  deleteSingleChannelMessage(channelId, messageId) {
    if (!messageId) return;
    const all = this.getItem('standupp_db_channel_msgs', {});
    const keysToCheck = [channelId, channelId?.replace?.(/^text-/, '')].filter(Boolean);
    let changed = false;
    keysToCheck.forEach((key) => {
      if (Array.isArray(all[key])) {
        const filtered = all[key].filter((m) => m?.id !== messageId);
        if (filtered.length !== all[key].length) {
          all[key] = filtered;
          changed = true;
        }
      }
    });
    if (changed) {
      this.setItem('standupp_db_channel_msgs', all);
      this.notifyTable('channel_messages', { eventType: 'DELETE', old: { id: messageId }, channelId });
    }
  }

  toggleReaction({ roomId, messageId, emoji, userId, userName: _userName, isDm }) {
    const storageKey = isDm ? 'standupp_db_dm_msgs' : 'standupp_db_channel_msgs';
    const all = this.getItem(storageKey, {});
    const list = all[roomId] || [];

    const msgIndex = list.findIndex((m) => m.id === messageId);
    if (msgIndex === -1) return null;

    const targetMsg = { ...list[msgIndex] };
    const reactions = Array.isArray(targetMsg.reactions) ? [...targetMsg.reactions] : [];
    const existingIndex = reactions.findIndex((r) => r.emoji === emoji);

    if (existingIndex > -1) {
      const existing = { ...reactions[existingIndex] };
      const users = Array.isArray(existing.users) ? [...existing.users] : [];
      const userIndex = users.indexOf(userId);

      if (userIndex > -1) {
        users.splice(userIndex, 1);
        if (users.length === 0) {
          reactions.splice(existingIndex, 1);
        } else {
          existing.users = users;
          existing.count = users.length;
          reactions[existingIndex] = existing;
        }
      } else {
        users.push(userId);
        existing.users = users;
        existing.count = users.length;
        reactions[existingIndex] = existing;
      }
    } else {
      reactions.push({
        emoji,
        count: 1,
        users: [userId],
      });
    }

    targetMsg.reactions = reactions;
    list[msgIndex] = targetMsg;
    all[roomId] = list;
    this.setItem(storageKey, all);

    this.notifyTable(isDm ? 'direct_messages' : 'channel_messages', {
      eventType: 'UPDATE',
      new: targetMsg,
      roomId,
    });

    return targetMsg;
  }

  notifyTable(table, payload) {
    const subs = this.tableSubscribers.get(table);
    if (subs) {
      subs.forEach((cb) => {
        try {
          cb(payload);
        } catch (err) {
          console.warn('Local table notify error:', err);
        }
      });
    }
  }

  subscribe(table, callback) {
    if (!this.tableSubscribers.has(table)) {
      this.tableSubscribers.set(table, new Set());
    }
    const subs = this.tableSubscribers.get(table);
    subs.add(callback);

    return () => {
      subs.delete(callback);
    };
  }

  getFriends() {
    const users = this.getUsers();
    const currentSession = this.getCurrentSession();
    const currentId = currentSession?.user?.id;

    return users
      .filter((u) => u.id !== currentId)
      .map((u) => ({
        id: u.id,
        name: u.display_name || u.username || 'Kullanıcı',
        avatar: u.avatar_url || null,
        game: null,
        substatus: '',
        status: 'offline',
        isOnline: false,
        isAway: false,
      }));
  }

  getFriendships() {
    return this.getItem('standupp_db_friendships', []);
  }

  saveFriendships(list) {
    this.setItem('standupp_db_friendships', list);
    this.notifyTable('friendships', { eventType: 'UPDATE', new: list });
  }

  getChannelMembers() {
    return this.getItem('standupp_db_channel_members', []);
  }

  saveChannelMembers(list) {
    this.setItem('standupp_db_channel_members', list);
    this.notifyTable('channel_members', { eventType: 'UPDATE', new: list });
  }

  purgeUserData(userId) {
    const summary = purgeUserFromStorage(userId);
    if (summary.updatedKeys.includes('standupp_db_friendships')) {
      this.notifyTable('friendships', { eventType: 'DELETE', old: { id: userId, user_id: userId } });
    }
    if (summary.updatedKeys.includes('standupp_db_channel_members')) {
      this.notifyTable('channel_members', { eventType: 'DELETE', old: { user_id: userId } });
    }
    if (summary.updatedKeys.includes('standupp_db_dm_msgs')) {
      this.notifyTable('direct_messages', { eventType: 'DELETE', old: { sender_id: userId, receiver_id: userId } });
    }
    if (summary.updatedKeys.includes('standupp_db_channel_msgs')) {
      this.notifyTable('channel_messages', { eventType: 'DELETE', old: { sender_id: userId } });
    }
    this.notifyTable('profiles', { eventType: 'DELETE', old: { id: userId } });
    return summary;
  }
}

export const localDb = new StanduppLocalEngine();

// Multiplexed Realtime table listeners to ensure a single persistent WebSocket channel per table
const sharedTableListeners = new Map();
const sharedSupabaseChannels = new Map();
const sharedChannelStatuses = new Map();
const sharedReconnectTimers = new Map();
const sharedReconnectAttempts = new Map();
const directRoomChannels = new Set();
const realtimeHealthListeners = new Set();
const realtimeRecoveredListeners = new Set();

const realtimeHealthState = {
  status: isSupabaseConfigured ? 'CONNECTING' : 'LOCAL_ONLY',
  lastConnectedAt: null,
  lastDisconnectedAt: null,
  lastError: null,
  reconnectCount: 0,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine !== false : true,
  activeChannels: 0,
};

let realtimeLifecycleInitialized = false;
let realtimeNeedsRecovery = false;
let lastVisibilityHiddenAt = 0;
let lastGlobalReconnectAt = 0;

function computeAggregateRealtimeStatus() {
  if (!isSupabaseConfigured || !supabase) return 'LOCAL_ONLY';
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'OFFLINE';
  const statuses = Array.from(sharedChannelStatuses.values());
  if (statuses.length === 0) return realtimeHealthState.status === 'DISCONNECTED' ? 'DISCONNECTED' : 'CONNECTING';
  if (statuses.some((s) => s === 'SUBSCRIBED')) return 'CONNECTED';
  if (statuses.some((s) => s === 'RECONNECTING' || s === 'CONNECTING')) return 'RECONNECTING';
  return 'DISCONNECTED';
}

function getRealtimeHealthSnapshot() {
  return {
    ...realtimeHealthState,
    activeChannels: sharedSupabaseChannels.size + directRoomChannels.size,
    tableStatuses: Object.fromEntries(sharedChannelStatuses.entries()),
  };
}

function notifyRealtimeHealth() {
  realtimeHealthState.status = computeAggregateRealtimeStatus();
  const snapshot = getRealtimeHealthSnapshot();
  realtimeHealthListeners.forEach((cb) => {
    try {
      cb(snapshot);
    } catch {}
  });
}

function notifyRealtimeRecovered(reason = 'recovered') {
  realtimeRecoveredListeners.forEach((cb) => {
    try {
      cb({ reason, at: Date.now() });
    } catch {}
  });
}

function createSharedTableChannel(table) {
  const existing = sharedSupabaseChannels.get(table);
  if (existing && supabase) {
    try {
      supabase.removeChannel(existing);
    } catch {}
  }

  sharedChannelStatuses.set(table, 'CONNECTING');
  const channel = supabase
    .channel(`shared_tbl_${table}_${Date.now().toString(36)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      (payload) => {
        const listeners = sharedTableListeners.get(table);
        if (listeners) {
          listeners.forEach((cb) => {
            try {
              cb(payload);
            } catch (e) {
              console.warn(`[Realtime ${table}] callback error:`, e);
            }
          });
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        const wasOfflineOrDropped =
          realtimeNeedsRecovery || sharedChannelStatuses.get(table) === 'DISCONNECTED' || sharedChannelStatuses.get(table) === 'RECONNECTING';
        sharedChannelStatuses.set(table, 'SUBSCRIBED');
        sharedReconnectAttempts.set(table, 0);
        const timer = sharedReconnectTimers.get(table);
        if (timer) {
          clearTimeout(timer);
          sharedReconnectTimers.delete(table);
        }
        realtimeHealthState.lastConnectedAt = new Date().toISOString();
        realtimeHealthState.lastError = null;
        if (wasOfflineOrDropped) {
          realtimeNeedsRecovery = false;
          notifyRealtimeRecovered(`channel_resubscribed:${table}`);
        }
        notifyRealtimeHealth();
        return;
      }

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        if (err) console.warn(`[Realtime ${table}] subscription warning:`, err);
        sharedChannelStatuses.set(table, 'DISCONNECTED');
        realtimeNeedsRecovery = true;
        realtimeHealthState.lastDisconnectedAt = new Date().toISOString();
        realtimeHealthState.lastError = err?.message || status;
        notifyRealtimeHealth();
        scheduleSharedTableReconnect(table);
      }
    });

  sharedSupabaseChannels.set(table, channel);
  notifyRealtimeHealth();
  return channel;
}

function scheduleSharedTableReconnect(table) {
  if (!isSupabaseConfigured || !supabase) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  const listeners = sharedTableListeners.get(table);
  if (!listeners || listeners.size === 0) return;
  if (sharedReconnectTimers.has(table)) return;

  const attempt = (sharedReconnectAttempts.get(table) || 0) + 1;
  sharedReconnectAttempts.set(table, attempt);
  const delayMs = [1500, 3000, 6000, 12000][Math.min(attempt - 1, 3)];

  sharedChannelStatuses.set(table, 'RECONNECTING');
  notifyRealtimeHealth();

  const timer = setTimeout(() => {
    sharedReconnectTimers.delete(table);
    const activeListeners = sharedTableListeners.get(table);
    if (!activeListeners || activeListeners.size === 0) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    realtimeHealthState.reconnectCount += 1;
    createSharedTableChannel(table);
  }, delayMs);

  sharedReconnectTimers.set(table, timer);
}

function reconnectAllSharedChannels(reason = 'manual') {
  if (!isSupabaseConfigured || !supabase) return false;
  const now = Date.now();
  if (now - lastGlobalReconnectAt < 2000) return false;
  lastGlobalReconnectAt = now;
  realtimeNeedsRecovery = true;
  realtimeHealthState.isOnline = typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
  realtimeHealthState.reconnectCount += 1;

  for (const timer of sharedReconnectTimers.values()) {
    clearTimeout(timer);
  }
  sharedReconnectTimers.clear();
  sharedReconnectAttempts.clear();

  for (const [table, listeners] of sharedTableListeners.entries()) {
    if (listeners && listeners.size > 0) {
      createSharedTableChannel(table);
    }
  }
  notifyRealtimeRecovered(reason);
  return true;
}

function ensureRealtimeLifecycleListeners() {
  if (realtimeLifecycleInitialized || !isSupabaseConfigured) return;
  realtimeLifecycleInitialized = true;

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      realtimeHealthState.isOnline = true;
      realtimeHealthState.lastError = null;
      notifyRealtimeHealth();
      reconnectAllSharedChannels('network_online');
    });

    window.addEventListener('offline', () => {
      realtimeHealthState.isOnline = false;
      realtimeNeedsRecovery = true;
      realtimeHealthState.lastDisconnectedAt = new Date().toISOString();
      realtimeHealthState.lastError = 'İnternet bağlantısı kesildi';
      notifyRealtimeHealth();
    });
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        lastVisibilityHiddenAt = Date.now();
      } else if (document.visibilityState === 'visible') {
        const hiddenDurationMs = lastVisibilityHiddenAt ? Date.now() - lastVisibilityHiddenAt : 0;
        if (realtimeNeedsRecovery || hiddenDurationMs > 20000) {
          const hasDisconnected = Array.from(sharedChannelStatuses.values()).some((s) => s !== 'SUBSCRIBED');
          if (hasDisconnected) {
            reconnectAllSharedChannels('visibility_resume');
          } else {
            notifyRealtimeRecovered('visibility_resume');
          }
        }
      }
    });
  }
}

// ==============================================================================
// Unified Supabase Data & Service Layer
// ==============================================================================
export const dbService = {
  // Auth Operations
  async signUp(email, password, metadata = {}) {
    const rawUsername = (metadata.username || (email ? email.split('@')[0] : 'kullanici')).trim().toLowerCase().replace(/[^a-z0-9_]/g, '') || 'user';
    const rawDisplayName = (metadata.display_name || metadata.username || rawUsername).trim();

    if (isSupabaseConfigured) {
      const maxRetries = 2;
      let lastResult = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            await new Promise((r) => setTimeout(r, attempt * 1000));
          }

          const res = await withTimeout(
            supabase.auth.signUp({
              email,
              password,
              options: {
                data: {
                  username: rawUsername,
                  display_name: rawDisplayName,
                  avatar_url: metadata.avatar_url || '',
                },
              },
            }),
            50000,
            'Sunucu yanıt vermedi (Zaman aşımı).'
          );

          if (res?.error) {
            const err = res.error;
            const msg = err.message || '';
            const status = err.status || 0;

            const isNonRetryable =
              status === 400 ||
              status === 422 ||
              msg.includes('already registered') ||
              msg.includes('Password should be at least');

            if (isNonRetryable || attempt >= maxRetries) {
              return res;
            }

            console.warn(`Supabase signUp attempt ${attempt + 1} transient error (${status}: ${msg}). Retrying...`);
            lastResult = res;
            continue;
          }

          if (res?.data?.user) {
            this.ensureProfile(res.data.user, {
              username: rawUsername,
              display_name: rawDisplayName,
              avatar_url: metadata.avatar_url || '',
            }).catch((err) => {
              console.warn('Supabase profile create background warning:', err);
            });
          }

          return res;
        } catch (err) {
          if (attempt >= maxRetries) {
            return {
              data: null,
              error: {
                message: 'Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol edin.',
                isNetworkOrTimeout: true,
              },
            };
          }
        }
      }

      return lastResult || {
        data: null,
        error: {
          message: 'Sunucuya bağlanılamadı.',
          isNetworkOrTimeout: true,
        },
      };
    }
    return localDb.signUp({ 
      email, 
      password, 
      options: { 
        data: { 
          ...metadata, 
          username: rawUsername, 
          display_name: rawDisplayName, 
        } 
      } 
    });
  },

  async signIn(email, password) {
    if (isSupabaseConfigured) {
      const maxRetries = 2; // total up to 3 attempts
      let lastResult = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            // Brief backoff: 1000ms on first retry, 2000ms on second
            await new Promise((r) => setTimeout(r, attempt * 1000));
          }

          const res = await withTimeout(
            supabase.auth.signInWithPassword({ email, password }),
            60000,
            'Sunucu yanıt vermedi (Zaman aşımı).'
          );

          if (res?.error) {
            const err = res.error;
            const msg = err.message || '';
            const status = err.status || 0;

            // Non-retryable errors (wrong credentials, unconfirmed email, rate limit) -> return immediately
            const isNonRetryable =
              status === 400 ||
              status === 422 ||
              status === 429 ||
              msg.includes('Invalid login credentials') ||
              msg.includes('Email not confirmed') ||
              msg.includes('rate limit');

            if (isNonRetryable || attempt >= maxRetries) {
              return res;
            }

            console.warn(`Supabase signIn attempt ${attempt + 1} transient error (${status}: ${msg}). Retrying...`);
            lastResult = res;
            continue;
          }

          // Successful sign-in! Ensure profile asynchronously without blocking the return
          if (res?.data?.user) {
            this.ensureProfile(res.data.user).catch((e) => {
              console.warn('signIn ensureProfile background notice:', e);
            });
          }

          return res;
        } catch (err) {
          const msg = err?.message || '';
          console.warn(`Supabase signIn attempt ${attempt + 1} threw (${msg}).`);

          if (attempt >= maxRetries) {
            return {
              data: null,
              error: {
                message: 'Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.',
                isNetworkOrTimeout: true,
              },
            };
          }
        }
      }

      return lastResult || {
        data: null,
        error: {
          message: 'Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.',
          isNetworkOrTimeout: true,
        },
      };
    }
    return localDb.signInWithPassword({ email, password });
  },

  async signOut() {
    if (isSupabaseConfigured) {
      try {
        await withTimeout(supabase.auth.signOut(), 3500);
      } catch (err) {
        console.warn('Supabase remote signOut error or timeout (proceeding with local signout):', err);
      }
      return { error: null };
    }
    return localDb.signOut();
  },

  async updateUserAuth(attributes) {
    if (isSupabaseConfigured) {
      try {
        const res = await supabase.auth.updateUser(attributes);
        if (!res.error && res.data?.user) {
          if (attributes.email) {
            try {
              await supabase.from('profiles').update({ email: attributes.email }).eq('id', res.data.user.id);
            } catch (e) {
              console.warn('Update profiles email error:', e);
            }
          }
          localDb.updateUser(res.data.user.id, {
            email: attributes.email || res.data.user.email,
          });
        }
        return res;
      } catch (err) {
        console.warn('updateUserAuth Supabase error:', err);
        return { data: null, error: err };
      }
    }

    const session = localDb.getCurrentSession();
    if (session?.user) {
      const updates = {};
      if (attributes.email) updates.email = attributes.email;
      if (attributes.password) updates.password = attributes.password;
      const updated = localDb.updateUser(session.user.id, updates);
      return { data: { user: updated }, error: null };
    }
    return { data: null, error: new Error('Oturum bulunamadı.') };
  },

  async updateUserPassword(newPassword) {
    return this.updateUserAuth({ password: newPassword });
  },

  async updateUserEmail(newEmail) {
    return this.updateUserAuth({ email: newEmail });
  },

  async resetPasswordForEmail(email, redirectTo) {
    if (isSupabaseConfigured) {
      try {
        const origin =
          typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost')
            ? window.location.origin
            : 'https://voys-omega.vercel.app';
        const redirect = redirectTo || `${origin}/reset-password`;
        const res = await withTimeout(
          supabase.auth.resetPasswordForEmail(email, { redirectTo: redirect }),
          45000,
          'Supabase sunucusu yanıt vermedi.'
        );
        return res;
      } catch (err) {
        console.warn('resetPasswordForEmail error:', err);
        return { data: null, error: err };
      }
    }
    return { data: {}, error: null };
  },

  async getSession() {
    if (isSupabaseConfigured) {
      return supabase.auth.getSession();
    }
    return { data: { session: localDb.getCurrentSession() }, error: null };
  },

  async getUser() {
    if (isSupabaseConfigured) {
      return supabase.auth.getUser();
    }
    const session = localDb.getCurrentSession();
    return { data: { user: session?.user || null }, error: null };
  },

  onAuthStateChange(callback) {
    if (isSupabaseConfigured) {
      return supabase.auth.onAuthStateChange((event, session) => {
        callback(event, session);
      });
    }
    return localDb.onAuthStateChange(callback);
  },

  // Channels Operations (Strictly filtered to channels where the user is an explicit member)
  async fetchChannels(userId) {
    if (!userId) return [];
    if (isSupabaseConfigured) {
      try {
        const { data: memberships, error: memError } = await withTimeout(
          supabase
            .from('channel_members')
            .select('channel_id')
            .eq('user_id', userId),
          10000,
          'Kanal üyelikleri alınırken zaman aşımı oluştu.'
        );

        if (memError) {
          console.warn('Supabase fetchChannels memberships error:', memError);
          return [];
        }

        const memberChannelIds = Array.from(
          new Set((memberships || []).map((m) => m.channel_id).filter(Boolean))
        ).filter((id) => id !== 'home' && id !== 'voice-sesli-sohbet');

        if (memberChannelIds.length === 0) {
          return [];
        }

        const { data, error } = await withTimeout(
          supabase
            .from('channels')
            .select('*')
            .in('id', memberChannelIds)
            .neq('id', 'home')
            .neq('id', 'voice-sesli-sohbet')
            .neq('is_home', true)
            .order('created_at', { ascending: true }),
          10000,
          'Kanallar alınırken zaman aşımı oluştu.'
        );

        if (!error && Array.isArray(data)) {
          return data
            .filter((c) => c && c.id !== 'home' && c.id !== 'voice-sesli-sohbet' && !c.is_home)
            .map((c) => ({
              ...c,
              avatar: c.avatar_url || c.avatar || '',
              avatar_url: c.avatar_url || c.avatar || '',
            }));
        }
        return [];
      } catch (err) {
        console.warn('Supabase fetchChannels error:', err);
        return [];
      }
    }
    return localDb.getChannels(userId);
  },

  async fetchAllGroupsForAdmin() {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: channels, error } = await supabase
          .from('channels')
          .select('id, name, type, is_home, created_by, created_at, avatar_url')
          .neq('id', 'home')
          .neq('id', 'voice-sesli-sohbet')
          .neq('is_home', true)
          .order('created_at', { ascending: false });

        if (error) {
          console.warn('fetchAllGroupsForAdmin channels error:', error);
          return [];
        }

        const { data: members } = await supabase
          .from('channel_members')
          .select('channel_id');

        const memberCountByChannel = {};
        (members || []).forEach((m) => {
          if (m?.channel_id) {
            memberCountByChannel[m.channel_id] = (memberCountByChannel[m.channel_id] || 0) + 1;
          }
        });

        const creatorIds = Array.from(new Set((channels || []).map((c) => c.created_by).filter(Boolean)));
        let profilesById = {};
        if (creatorIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url')
            .in('id', creatorIds);
          (profiles || []).forEach((p) => {
            profilesById[p.id] = p;
          });
        }

        return (channels || []).map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          avatar_url: c.avatar_url || '',
          created_by: c.created_by,
          created_at: c.created_at,
          creator_name: profilesById[c.created_by]?.display_name || profilesById[c.created_by]?.username || 'Bilinmiyor',
          creator_username: profilesById[c.created_by]?.username || '',
          creator_avatar_url: profilesById[c.created_by]?.avatar_url || '',
          member_count: memberCountByChannel[c.id] || 0,
        }));
      } catch (err) {
        console.warn('fetchAllGroupsForAdmin error:', err);
        return [];
      }
    }
    const allChannels = localDb.getChannels?.() || [];
    return allChannels.filter((c) => c && c.id !== 'home' && c.id !== 'voice-sesli-sohbet' && !c.is_home);
  },

  async createChannel(channel) {
    let createdChannel = channel;
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('channels')
          .insert([
            {
              id: channel.id,
              name: channel.name,
              type: channel.type,
              is_home: channel.is_home || false,
              created_by: channel.created_by || null,
            },
          ])
          .select()
          .single();

        if (!error && data) {
          createdChannel = data;
        }

        // Automatically assign creator as admin in channel_members
        if (channel.created_by && channel.id) {
          await this.addChannelMember(channel.id, channel.created_by, 'admin').catch((memErr) => {
            console.warn('Channel member admin insert warning:', memErr);
          });
        }
      } catch (err) {
        console.warn('Supabase channel insert error:', err);
      }
    } else {
      createdChannel = localDb.addChannel(channel);
    }

    if (channel.created_by && channel.id) {
      const list = localDb.getChannelMembers();
      if (!list.some((m) => m.channel_id === channel.id && m.user_id === channel.created_by)) {
        list.push({
          id: `cm-${Date.now()}`,
          channel_id: channel.id,
          user_id: channel.created_by,
          role: 'admin',
          joined_at: new Date().toISOString(),
        });
        localDb.saveChannelMembers(list);
      }
    }

    return createdChannel;
  },

  async updateChannel(channelId, updates) {
    const localResult = localDb.updateChannel(channelId, updates);
    let result = null;
    if (isSupabaseConfigured) {
      try {
        const dbUpdates = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.type !== undefined) dbUpdates.type = updates.type;
        if (updates.is_home !== undefined) dbUpdates.is_home = updates.is_home;
        if (updates.avatar_url !== undefined || updates.avatar !== undefined) {
          dbUpdates.avatar_url = updates.avatar_url !== undefined ? updates.avatar_url : updates.avatar;
        }

        const { data, error } = await withTimeout(
          supabase
            .from('channels')
            .update(dbUpdates)
            .eq('id', channelId)
            .select()
            .single(),
          10000,
          'updateChannel zaman aşımı'
        );
        if (!error && data) {
          result = {
            ...data,
            avatar: data.avatar_url || '',
            avatar_url: data.avatar_url || '',
          };
        } else if (error) {
          console.warn('Supabase updateChannel error:', error);
        }
      } catch (err) {
        console.warn('Supabase updateChannel error:', err);
      }
    }
    return result || localResult;
  },

  // Delete Channel (Permanently removes channel, members, and messages)
  async deleteChannel(channelId) {
    if (!channelId) return;
    const cleanId = String(channelId || '').replace(/^text-/, '');
    const targetIds = Array.from(new Set([channelId, cleanId, `text-${cleanId}`]));

    // 1. Delete from local cache
    try {
      const saved = localStorage.getItem('standupp_text_channels') || localStorage.getItem('standupp_db_channels');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((c) => c && !targetIds.includes(c.id));
          localStorage.setItem('standupp_text_channels', JSON.stringify(filtered));
          localStorage.setItem('standupp_db_channels', JSON.stringify(filtered));
        }
      }
      targetIds.forEach((id) => localDb.deleteChannelMessages(id));
      localDb.notifyTable('channels', { eventType: 'DELETE', old: { id: channelId } });
    } catch {}

    // 2. Delete from Supabase cloud database
    if (isSupabaseConfigured) {
      try {
        await supabase.from('channel_members').delete().in('channel_id', targetIds);
        await supabase.from('channel_messages').delete().in('channel_id', targetIds);
        const { error } = await supabase.from('channels').delete().in('id', targetIds);
        if (error) {
          console.error('Supabase deleteChannel error:', error);
          throw error;
        }
      } catch (err) {
        console.error('deleteChannel exception:', err);
        throw err;
      }
    }
    return true;
  },

  // Channel Members Operations
  async fetchChannelMembers(channelId) {
    if (isSupabaseConfigured) {
      try {
        const { data: memberRows, error } = await withTimeout(
          supabase
            .from('channel_members')
            .select('*')
            .eq('channel_id', channelId),
          6000,
          'Grup üyeleri alınırken zaman aşımı oluştu.'
        );

        if (!error && Array.isArray(memberRows)) {
          if (memberRows.length === 0) return [];
          const userIds = memberRows.map((m) => m.user_id);

          let profiles = null;
          try {
            const { data } = await withTimeout(
              supabase
                .from('profiles')
                .select('id, username, display_name, avatar_url, status, substatus, game')
                .in('id', userIds),
              5000,
              'Üye profilleri alınırken zaman aşımı oluştu.'
            );
            profiles = data;
          } catch (profErr) {
            console.warn('Profiles fetch warning in fetchChannelMembers:', profErr);
          }

          if (profiles) {
            cacheUserProfiles(profiles);
          }
          const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

          const mapped = memberRows.map((m) => {
            const prof = profileMap.get(m.user_id) || {};
            const cached = getCachedUserProfile(m.user_id);
            const resolvedName = pickDisplayName(
              [prof.display_name, prof.username, cached?.name, cached?.display_name, cached?.username],
              'Kullanıcı'
            );
            const resolvedAvatar = prof.avatar_url || cached?.avatar_url || cached?.avatar || null;
            return {
              ...m,
              name: resolvedName,
              username: (!isUuidLike(prof.username) && prof.username) || cached?.username || 'user',
              avatar: resolvedAvatar,
              avatar_url: resolvedAvatar,
              game: prof.game || cached?.game || '',
              substatus: prof.substatus || cached?.substatus || '',
              status: prof.status || cached?.status || 'offline',
              profile: prof,
              profiles: prof,
            };
          });

          // Save to localStorage cache for instant loading on refresh
          try {
            if (typeof localStorage !== 'undefined' && mapped.length > 0) {
              localStorage.setItem(`voys_channel_members_${channelId}`, JSON.stringify(mapped));
            }
          } catch {}

          return mapped;
        }
      } catch (err) {
        console.warn('Supabase fetchChannelMembers error:', err);
      }

      // Fallback to localStorage cache if network query failed or timed out
      try {
        if (typeof localStorage !== 'undefined') {
          const raw = localStorage.getItem(`voys_channel_members_${channelId}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
          }
        }
      } catch {}
      return [];
    }
    const members = localDb.getChannelMembers().filter((m) => m.channel_id === channelId);
    const users = localDb.getUsers();
    const userMap = new Map(users.map((u) => [u.id, u]));
    return members.map((m) => {
      const u = userMap.get(m.user_id) || { id: m.user_id, name: 'Kullanıcı' };
      return {
        ...m,
        name: u.display_name || u.name || u.username || 'Kullanıcı',
        username: u.username || 'user',
        avatar: u.avatar_url || u.avatar || null,
        avatar_url: u.avatar_url || u.avatar || null,
        game: u.game || '',
        substatus: u.substatus || '',
        status: u.status || 'offline',
        profile: u,
        profiles: u,
      };
    });
  },

  async addChannelMember(channelId, userId, role = 'member') {
    if (!channelId || !userId) return null;
    if (isSupabaseConfigured) {
      const { data, error } = await withTimeout(
        supabase
          .from('channel_members')
          .insert([
            {
              channel_id: channelId,
              user_id: userId,
              role,
            },
          ])
          .select()
          .single(),
        10000,
        'Üye ekleme isteği zaman aşımına uğradı. Lütfen tekrar deneyin.'
      );

      if (error) {
        if (error.code === '23505') {
          const { data: dupRow } = await withTimeout(
            supabase
              .from('channel_members')
              .select('*')
              .eq('channel_id', channelId)
              .eq('user_id', userId)
              .maybeSingle(),
            8000,
            'Mevcut üyelik kontrolü zaman aşımına uğradı.'
          );
          if (dupRow) {
            const list = localDb.getChannelMembers();
            if (!list.some((m) => m.channel_id === channelId && m.user_id === userId)) {
              localDb.saveChannelMembers([...list, dupRow]);
            }
            return dupRow;
          }
          return { channel_id: channelId, user_id: userId, role };
        }
        throw error;
      }

      if (data) {
        const list = localDb.getChannelMembers();
        if (!list.some((m) => m.channel_id === channelId && m.user_id === userId)) {
          localDb.saveChannelMembers([...list, data]);
        }
        return data;
      }
      return null;
    }
    const list = localDb.getChannelMembers();
    const existing = list.find((m) => m.channel_id === channelId && m.user_id === userId);
    if (!existing) {
      const entry = {
        id: `cm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        channel_id: channelId,
        user_id: userId,
        role,
        joined_at: new Date().toISOString(),
      };
      list.push(entry);
      localDb.saveChannelMembers(list);
      return entry;
    }
    return existing;
  },

  async removeChannelMember(channelId, userId) {
    if (!channelId || !userId) {
      throw new Error('Eksik grup veya kullanıcı bilgisi.');
    }

    if (isSupabaseConfigured) {
      const { error } = await withTimeout(
        supabase
          .from('channel_members')
          .delete()
          .eq('channel_id', channelId)
          .eq('user_id', userId),
        10000,
        'Üye gruptan çıkarılırken zaman aşımı oluştu.'
      );
      if (error) {
        throw new Error(error.message || 'Üye gruptan çıkarılamadı.');
      }
    }

    const list = localDb.getChannelMembers();
    localDb.saveChannelMembers(
      list.filter((m) => !(String(m.channel_id) === String(channelId) && String(m.user_id) === String(userId)))
    );
    return true;
  },

  // Channel Messages Operations
  async fetchMessages(channelId) {
    return this.fetchChannelMessages(channelId);
  },

  async fetchChannelMessages(channelId) {
    const rawChan = String(channelId || '');
    const cleanChan = rawChan.replace(/^text-/, '');
    const targetIds = Array.from(new Set([rawChan, cleanChan, `text-${cleanChan}`])).filter(Boolean);
    const clearedAt = this.getChannelClearedAt ? this.getChannelClearedAt(rawChan) : 0;

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await withTimeout(
          supabase
            .from('channel_messages')
            .select('*')
            .in('channel_id', targetIds)
            .order('sent_at', { ascending: true }),
          12000,
          'Kanal mesajları alınırken zaman aşımı oluştu.'
        );

        if (!error && Array.isArray(data)) {
          const mapped = data
            .map((row) => {
              const rawSentAt = row.sent_at ?? row.sentAt;
              const parsedSentAt = rawSentAt
                ? (typeof rawSentAt === 'number' ? rawSentAt : (!isNaN(Number(rawSentAt)) ? Number(rawSentAt) : new Date(rawSentAt).getTime()))
                : (row.created_at ? new Date(row.created_at).getTime() : undefined);

              const formatTimeHHMM = (msOrDate) => {
                if (!msOrDate) return '';
                const d = new Date(msOrDate);
                if (isNaN(d.getTime())) return '';
                return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
              };

              return {
                id: row.id,
                channel_id: row.channel_id,
                user: row.sender_name,
                userId: row.sender_id,
                avatar: row.sender_avatar || null,
                color: (row.color && row.color !== '#90ba3c' && row.color !== CLASSIC_PURPLE) ? row.color : getUserColor(row.sender_id || row.sender_name, false),
                hasCrown: row.has_crown || false,
                lines: Array.isArray(row.lines) ? row.lines : (row.lines ? [row.lines] : []),
                attachments: Array.isArray(row.attachments) ? row.attachments : [],
                parent_id: row.parent_id || null,
                reply_to: row.reply_to ? (typeof row.reply_to === 'string' ? JSON.parse(row.reply_to) : row.reply_to) : null,
                reactions: row.reactions ? (typeof row.reactions === 'string' ? JSON.parse(row.reactions) : row.reactions) : [],
                timestamp: row.timestamp_text || formatTimeHHMM(parsedSentAt),
                sentAt: parsedSentAt,
                sent_at: parsedSentAt,
                created_at: row.created_at,
              };
            })
            .filter((m) => {
              if (clearedAt && (m.sentAt || m.sent_at) && (m.sentAt || m.sent_at) <= clearedAt) {
                return false;
              }
              return true;
            });

          localDb.saveChannelMessages(channelId, mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('Supabase fetchChannelMessages error:', err);
      }
    }
    const localMsgs = localDb.getChannelMessages(channelId);
    if (clearedAt && Array.isArray(localMsgs)) {
      return localMsgs.filter((m) => {
        const t = Number(m?.sent_at ?? m?.sentAt) || (m?.created_at ? new Date(m.created_at).getTime() : 0);
        return !t || t > clearedAt;
      });
    }
    return localMsgs;
  },

  async saveChannelMessage(channelId, message) {
    if (isSupabaseConfigured) {
      try {
        const rawAvatar = typeof message.avatar === 'string' ? message.avatar : '';
        const safeAvatar = rawAvatar.startsWith('data:') && rawAvatar.length > 2000 ? '' : rawAvatar;
        const dbRow = {
          id: message.id,
          channel_id: channelId,
          sender_id: message.userId,
          sender_name: message.user,
          sender_avatar: safeAvatar,
          color: message.color || (message.userId === 'you' ? CLASSIC_PURPLE : getUserColor(message.userId || message.user, false)),
          has_crown: message.hasCrown || false,
          lines: message.lines || (message.text ? [message.text] : []),
          attachments: message.attachments || [],
          parent_id: message.parent_id || message.parentId || null,
          reply_to: message.reply_to ? JSON.stringify(message.reply_to) : null,
          reactions: message.reactions ? JSON.stringify(message.reactions) : '[]',
          timestamp_text: message.timestamp,
          sent_at: message.sentAt || Date.now(),
        };
        await withTimeout(
          supabase.from('channel_messages').insert([dbRow]),
          10000,
          'Mesaj gönderilirken zaman aşımı oluştu.'
        );
      } catch (err) {
        console.warn('Supabase saveChannelMessage error:', err);
      }
    }
    return localDb.addChannelMessage(channelId, message);
  },

  // Direct Messages (DM) Operations
  async fetchDmMessages(roomId, currentUserId = null, otherUserId = null) {
    let user1 = normalizeParticipantId(currentUserId);
    let user2 = normalizeParticipantId(otherUserId);

    if (user1 === 'you') user1 = null;
    if (user2 === 'you') user2 = null;

    if (!user1 || !user2) {
      const roomPair = parseDmRoomPair(roomId);
      if (roomPair) {
        if (!user1) user1 = roomPair[0];
        if (!user2) user2 = roomPair[1];
      }
    }

    if (!user1 || !user2) {
      return [];
    }

    const canonical = getDmRoomId(user1, user2);

    if (isSupabaseConfigured) {
      try {
        const dmColumns =
          'id, room_id, sender_id, receiver_id, sender_name, color, has_crown, lines, attachments, parent_id, reply_to, reactions, timestamp_text, sent_at, read_at, delivered_at, created_at';
        const pairRoomIds = Array.from(new Set([canonical, `dm-${user2}--${user1}`]));

        // Query strictly by verified participant pair (captures legacy single-ID `dm-<id>` rows
        // ONLY when sender_id & receiver_id belong to (user1, user2)) plus canonical pair room IDs.
        const [sentRes, recvRes, roomRes] = await Promise.all([
          withTimeout(
            supabase
              .from('direct_messages')
              .select(dmColumns)
              .eq('sender_id', user1)
              .eq('receiver_id', user2)
              .order('sent_at', { ascending: true }),
            12000,
            'DM mesajları alınırken zaman aşımı oluştu.'
          ),
          withTimeout(
            supabase
              .from('direct_messages')
              .select(dmColumns)
              .eq('sender_id', user2)
              .eq('receiver_id', user1)
              .order('sent_at', { ascending: true }),
            12000,
            'DM mesajları alınırken zaman aşımı oluştu.'
          ),
          withTimeout(
            supabase
              .from('direct_messages')
              .select(dmColumns)
              .in('room_id', pairRoomIds)
              .order('sent_at', { ascending: true }),
            12000,
            'DM mesajları alınırken zaman aşımı oluştu.'
          ),
        ]);

        const hadSuccessfulQuery = !sentRes.error || !recvRes.error || !roomRes.error;
        if (hadSuccessfulQuery) {
          const combined = [
            ...(Array.isArray(sentRes.data) ? sentRes.data : []),
            ...(Array.isArray(recvRes.data) ? recvRes.data : []),
            ...(Array.isArray(roomRes.data) ? roomRes.data : []),
          ];
          const seen = new Set();
          const getRowTime = (item) => {
            const raw = item?.sent_at ?? item?.sentAt;
            const num = Number(raw);
            if (!Number.isNaN(num) && num > 0) return num;
            return item?.created_at ? new Date(item.created_at).getTime() || 0 : 0;
          };

          const clearedAt = this.getDmClearedAt(user1, canonical, user2);

          const realMessages = combined
            .filter((row) => {
              if (!row?.id || seen.has(row.id)) return false;
              seen.add(row.id);
              if (row.room_id === 'dm-control-cleared') return false;
              if (clearedAt && getRowTime(row) <= clearedAt) return false;
              return isDirectMessageForPair(row, user1, user2);
            })
            .sort((a, b) => getRowTime(a) - getRowTime(b));

          const mapped = realMessages.map(mapDirectMessageRow);
          localDb.saveDmMessages(canonical, mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('Supabase fetchDmMessages error:', err);
      }
    }

    return localDb.getDmMessages(canonical, user1);
  },

  // Batched latest DM lookup for Sidebar (eliminates N+1 per-friend query bursts)
  async fetchLatestDmMessagesBatch(currentUserId, friendIds = []) {
    const me = normalizeParticipantId(currentUserId);
    const cleanIds = Array.from(new Set((friendIds || []).map(normalizeParticipantId).filter(Boolean)));
    if (!me || me === 'you' || cleanIds.length === 0) return {};

    const canonicalByFriend = new Map();
    cleanIds.forEach((fid) => {
      canonicalByFriend.set(fid, getDmRoomId(me, fid));
    });
    const validFriendSet = new Set(cleanIds);

    const latestByCanonicalRoom = {};

    if (isSupabaseConfigured && supabase) {
      try {
        const dmColumns =
          'id, room_id, sender_id, receiver_id, sender_name, color, has_crown, lines, attachments, parent_id, reply_to, reactions, timestamp_text, sent_at, read_at, delivered_at, created_at';
        const limit = Math.min(400, Math.max(40, cleanIds.length * 10));

        const [sentRes, recvRes] = await Promise.all([
          withTimeout(
            supabase
              .from('direct_messages')
              .select(dmColumns)
              .eq('sender_id', me)
              .in('receiver_id', cleanIds)
              .order('sent_at', { ascending: false })
              .limit(limit),
            10000,
            'Son DM özetleri yüklenirken zaman aşımı.'
          ),
          withTimeout(
            supabase
              .from('direct_messages')
              .select(dmColumns)
              .eq('receiver_id', me)
              .in('sender_id', cleanIds)
              .order('sent_at', { ascending: false })
              .limit(limit),
            10000,
            'Son DM özetleri yüklenirken zaman aşımı.'
          ),
        ]);

        if (!sentRes.error || !recvRes.error) {
          const getRowTime = (item) => {
            const raw = item?.sent_at ?? item?.sentAt;
            const num = Number(raw);
            if (!Number.isNaN(num) && num > 0) return num;
            return item?.created_at ? new Date(item.created_at).getTime() || 0 : 0;
          };
          const combined = [
            ...(Array.isArray(sentRes.data) ? sentRes.data : []),
            ...(Array.isArray(recvRes.data) ? recvRes.data : []),
          ].sort((a, b) => getRowTime(b) - getRowTime(a));

          for (const row of combined) {
            if (row.room_id === 'dm-control-cleared') continue;
            const partnerId = resolveDirectMessagePartner(row, me, validFriendSet);
            if (!partnerId) continue;
            const canonical = canonicalByFriend.get(partnerId);
            if (!canonical || latestByCanonicalRoom[canonical]) continue;
            const clearedAt = this.getDmClearedAt(me, canonical, partnerId);
            if (clearedAt && getRowTime(row) <= clearedAt) continue;
            latestByCanonicalRoom[canonical] = mapDirectMessageRow(row);
          }
          return latestByCanonicalRoom;
        }
      } catch (err) {
        console.warn('Supabase fetchLatestDmMessagesBatch error:', err);
      }
    }

    // Local fallback
    canonicalByFriend.forEach((canonical, fid) => {
      if (!latestByCanonicalRoom[canonical]) {
        const localCanonical = localDb.getDmMessages(canonical, me);
        if (Array.isArray(localCanonical) && localCanonical.length > 0) {
          latestByCanonicalRoom[canonical] = localCanonical[localCanonical.length - 1];
        }
      }
    });
    return latestByCanonicalRoom;
  },

  // Batched latest Channel lookup for Sidebar
  async fetchLatestChannelMessagesBatch(channelIds = []) {
    const cleanIds = Array.from(new Set((channelIds || []).filter(Boolean)));
    if (cleanIds.length === 0) return {};

    const latestByChannel = {};

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await withTimeout(
          supabase
            .from('channel_messages')
            .select('*')
            .in('channel_id', cleanIds)
            .order('sent_at', { ascending: false })
            .limit(100),
          6000,
          'fetchLatestChannelMessagesBatch timeout'
        );

        if (!error && Array.isArray(data)) {
          for (const row of data) {
            if (!row?.channel_id || latestByChannel[row.channel_id]) continue;
            const rawSentAt = row.sent_at ?? row.sentAt;
            const parsedSentAt = rawSentAt
              ? (typeof rawSentAt === 'number' ? rawSentAt : (!isNaN(Number(rawSentAt)) ? Number(rawSentAt) : new Date(rawSentAt).getTime()))
              : (row.created_at ? new Date(row.created_at).getTime() : Date.now());

            latestByChannel[row.channel_id] = {
              id: row.id,
              channel_id: row.channel_id,
              room_id: row.channel_id,
              userId: row.sender_id,
              user: row.sender_name,
              lines: Array.isArray(row.lines) ? row.lines : (row.lines ? [row.lines] : []),
              attachments: Array.isArray(row.attachments) ? row.attachments : [],
              timestamp: row.timestamp_text,
              sentAt: parsedSentAt,
              sent_at: parsedSentAt,
            };
          }
          return latestByChannel;
        }
      } catch (err) {
        console.warn('Supabase fetchLatestChannelMessagesBatch error:', err);
      }
    }

    // Local fallback
    cleanIds.forEach((cid) => {
      const localMsgs = localDb.getChannelMessages(cid);
      if (Array.isArray(localMsgs) && localMsgs.length > 0) {
        latestByChannel[cid] = localMsgs[localMsgs.length - 1];
      }
    });

    return latestByChannel;
  },

  async markDmMessagesRead(readerId, otherUserId) {
    if (!readerId || !otherUserId || readerId === 'you' || otherUserId === 'you') return;
    const now = Date.now();
    const roomId = getDmRoomId(readerId, otherUserId);

    localDb.markDmRead(roomId, readerId, now);

    if (isSupabaseConfigured && supabase) {
      try {
        await withTimeout(
          supabase
            .from('direct_messages')
            .update({ read_at: now })
            .eq('receiver_id', readerId)
            .eq('sender_id', otherUserId)
            .is('read_at', null),
          6000,
          'markDmMessagesRead timeout'
        );
      } catch (err) {
        console.warn('Supabase markDmMessagesRead error:', err);
      }
    }
  },

  async markChannelRead(channelId, userId) {
    if (!channelId || !userId || userId === 'you') return;
    const cleanId = String(channelId).replace(/^text-/, '');
    const nowIso = new Date().toISOString();
    const candidateChannelIds = Array.from(new Set([channelId, cleanId, `text-${cleanId}`]));

    try {
      localStorage.setItem(`voys_last_read_${userId}_${channelId}`, String(Date.now()));
      localStorage.setItem(`voys_last_read_${userId}_${cleanId}`, String(Date.now()));
    } catch {}

    if (isSupabaseConfigured && supabase) {
      try {
        const { error: rpcErr } = await withTimeout(
          supabase.rpc('mark_channel_read', {
            p_channel_id: channelId,
            p_user_id: userId,
          }),
          4000,
          'mark_channel_read RPC timeout'
        );

        if (rpcErr) {
          await withTimeout(
            supabase
              .from('channel_members')
              .update({ last_read_at: nowIso })
              .eq('user_id', userId)
              .in('channel_id', candidateChannelIds),
            4000,
            'channel_members update timeout'
          );
        }
      } catch (err) {
        console.warn('Supabase markChannelRead error:', err);
      }
    }
  },

  async fetchUnreadCounts(userId) {
    if (!userId || userId === 'you') return {};
    const unreadMap = {};

    if (isSupabaseConfigured && supabase) {
      try {
        const [channelRes, dmRes] = await Promise.allSettled([
          withTimeout(
            supabase.rpc('get_unread_channel_counts', { p_user_id: userId }),
            5000,
            'get_unread_channel_counts timeout'
          ),
          withTimeout(
            supabase.rpc('get_unread_dm_counts', { p_user_id: String(userId) }),
            5000,
            'get_unread_dm_counts timeout'
          ),
        ]);

        if (channelRes.status === 'fulfilled' && !channelRes.value?.error && Array.isArray(channelRes.value?.data)) {
          for (const row of channelRes.value.data) {
            const count = Number(row?.unread_count) || 0;
            if (row?.channel_id && count > 0) {
              const cid = String(row.channel_id);
              const clean = cid.replace(/^text-/, '');
              unreadMap[cid] = count;
              unreadMap[clean] = count;
              unreadMap[`text-${clean}`] = count;
            }
          }
        } else if (channelRes.status === 'rejected' || channelRes.value?.error) {
          const { data: memberRows } = await withTimeout(
            supabase
              .from('channel_members')
              .select('channel_id, last_read_at, joined_at')
              .eq('user_id', userId),
            4000,
            'channel_members fallback timeout'
          );

          if (Array.isArray(memberRows) && memberRows.length > 0) {
            for (const mem of memberRows) {
              const lastRead = mem.last_read_at || mem.joined_at;
              if (lastRead) {
                const { count } = await supabase
                  .from('channel_messages')
                  .select('*', { count: 'exact', head: true })
                  .eq('channel_id', mem.channel_id)
                  .neq('sender_id', String(userId))
                  .gt('created_at', lastRead);

                if (typeof count === 'number' && count > 0) {
                  const cid = String(mem.channel_id);
                  const clean = cid.replace(/^text-/, '');
                  unreadMap[cid] = count;
                  unreadMap[clean] = count;
                  unreadMap[`text-${clean}`] = count;
                }
              }
            }
          }
        }

        if (dmRes.status === 'fulfilled' && !dmRes.value?.error && Array.isArray(dmRes.value?.data)) {
          for (const row of dmRes.value.data) {
            const count = Number(row?.unread_count) || 0;
            const senderId = row?.sender_id ? String(row.sender_id) : null;
            const roomId = row?.room_id ? String(row.room_id) : null;
            if (
              count > 0 &&
              senderId &&
              senderId !== String(userId) &&
              roomId !== 'dm-control-cleared'
            ) {
              unreadMap[senderId] = count;
              if (roomId) unreadMap[roomId] = count;
            }
          }
        }
      } catch (err) {
        console.warn('Supabase fetchUnreadCounts error:', err);
      }
    }

    return unreadMap;
  },

  async markDmMessagesDelivered(receiverId, senderId) {
    if (!receiverId || !senderId || receiverId === 'you' || senderId === 'you') return;
    const now = Date.now();
    if (isSupabaseConfigured && supabase) {
      try {
        await withTimeout(
          supabase
            .from('direct_messages')
            .update({ delivered_at: now })
            .eq('receiver_id', receiverId)
            .eq('sender_id', senderId)
            .is('delivered_at', null),
          6000,
          'markDmMessagesDelivered timeout'
        );
      } catch (err) {
        console.warn('Supabase markDmMessagesDelivered error:', err);
      }
    }
  },

  async saveDmMessage(roomId, message, senderId, receiverId) {
    let canonicalRoomId = roomId;
    if (senderId && receiverId) {
      canonicalRoomId = getDmRoomId(senderId, receiverId);
    }

    if (isSupabaseConfigured) {
      try {
        const rawAvatar = typeof message.avatar === 'string' ? message.avatar : '';
        const safeAvatar = rawAvatar.startsWith('data:') && rawAvatar.length > 2000 ? '' : rawAvatar;
        const dbRow = {
          id: message.id,
          room_id: canonicalRoomId,
          sender_id: senderId,
          receiver_id: receiverId,
          sender_name: message.user || 'Kullanıcı',
          sender_avatar: safeAvatar,
          color: message.color || (message.userId === 'you' ? CLASSIC_PURPLE : getUserColor(message.userId || message.user, false)),
          has_crown: message.hasCrown || false,
          lines: message.lines || (message.text ? [message.text] : []),
          attachments: message.attachments || [],
          parent_id: message.parent_id || message.parentId || null,
          reply_to: message.reply_to ? (typeof message.reply_to === 'string' ? message.reply_to : JSON.stringify(message.reply_to)) : null,
          reactions: message.reactions ? (typeof message.reactions === 'string' ? message.reactions : JSON.stringify(message.reactions)) : '[]',
          timestamp_text: message.timestamp,
          sent_at: message.sentAt || Date.now(),
        };
        await withTimeout(
          supabase.from('direct_messages').insert([dbRow]),
          10000,
          'Mesaj gönderilirken zaman aşımı oluştu.'
        );
      } catch (err) {
        console.warn('Supabase saveDmMessage error:', err);
      }
    }
    const localMsg = {
      ...message,
      room_id: canonicalRoomId,
      room: canonicalRoomId,
      sender_id: senderId || message.sender_id || message.userId,
      userId: message.userId || senderId,
      receiver_id: receiverId || message.receiver_id || null,
    };
    return localDb.addDmMessage(canonicalRoomId, localMsg);
  },

  // Get channel cleared timestamp
  getChannelClearedAt(channelId) {
    if (!channelId || typeof localStorage === 'undefined') return 0;
    try {
      const rawChan = String(channelId || '');
      const cleanChan = rawChan.replace(/^text-/, '');
      const keys = [
        `voys_channel_cleared_${rawChan}`,
        `voys_channel_cleared_${cleanChan}`,
        `voys_channel_cleared_text-${cleanChan}`,
      ];
      let maxTime = 0;
      for (const k of keys) {
        const val = localStorage.getItem(k);
        if (val) {
          const num = Number(val);
          if (!Number.isNaN(num) && num > maxTime) maxTime = num;
        }
      }
      return maxTime;
    } catch {
      return 0;
    }
  },

  // Set channel cleared timestamp and purge all local cached message keys for this channel
  setChannelClearedAt(channelId, timestamp = Date.now()) {
    if (!channelId || typeof localStorage === 'undefined') return;
    try {
      const rawChan = String(channelId || '');
      const cleanChan = rawChan.replace(/^text-/, '');
      const ts = Number(timestamp) || Date.now();
      const str = String(ts);
      const targetIds = Array.from(new Set([rawChan, cleanChan, `text-${cleanChan}`])).filter(Boolean);
      targetIds.forEach((id) => {
        localStorage.setItem(`voys_channel_cleared_${id}`, str);
        localStorage.removeItem(`voys_cached_msgs_${id}`);
      });
      localStorage.removeItem('standupp_cached_messages');
    } catch {}
  },

  // Get DM cleared timestamp for a user and room
  getDmClearedAt(userId, roomId, partnerId) {
    if (!userId) return 0;
    try {
      const normUser = normalizeParticipantId(userId);
      const keys = [
        roomId ? `voys_dm_cleared_${normUser}_${roomId}` : null,
        partnerId ? `voys_dm_cleared_${normUser}_${partnerId}` : null,
      ].filter(Boolean);
      for (const k of keys) {
        const val = localStorage.getItem(k);
        if (val) {
          const num = Number(val);
          if (!Number.isNaN(num) && num > 0) return num;
        }
      }
    } catch {}
    return 0;
  },

  // Save DM cleared timestamp for a user (One-sided clear / Tek taraflı silme)
  async clearDmForUser(userId, partnerId, roomId) {
    if (!userId) return false;
    const normUser = normalizeParticipantId(userId);
    const normPartner = partnerId ? normalizeParticipantId(partnerId) : null;
    const canonical = (normUser && normPartner) ? getCanonicalDmRoomId(normUser, normPartner) : roomId;
    const clearedAt = Date.now();

    // 1. Save synchronously to localStorage
    try {
      if (canonical) localStorage.setItem(`voys_dm_cleared_${normUser}_${canonical}`, String(clearedAt));
      if (roomId) localStorage.setItem(`voys_dm_cleared_${normUser}_${roomId}`, String(clearedAt));
      if (normPartner) localStorage.setItem(`voys_dm_cleared_${normUser}_${normPartner}`, String(clearedAt));
    } catch {}

    // 2. Persist to Supabase so it syncs across devices
    if (isSupabaseConfigured && supabase) {
      try {
        const controlId = `dm_clear_${normUser}_${canonical || roomId || normPartner}`;
        const payload = {
          id: controlId,
          room_id: 'dm-control-cleared',
          sender_id: normUser,
          receiver_id: normUser,
          sender_name: 'System',
          lines: [JSON.stringify({ type: 'dm_cleared', targetRoomId: canonical || roomId, partnerId: normPartner, clearedAt })],
          sent_at: clearedAt,
          read_at: clearedAt,
          delivered_at: clearedAt,
        };
        await supabase.from('direct_messages').upsert(payload, { onConflict: 'id' });
      } catch (err) {
        console.warn('Supabase clearDmForUser persistence error:', err);
      }
    }

    return true;
  },

  // Load DM cleared records from Supabase on start / auth
  async loadUserDmClearedRecords(userId) {
    if (!isSupabaseConfigured || !supabase || !userId) return;
    try {
      const normUser = normalizeParticipantId(userId);
      const { data, error } = await supabase
        .from('direct_messages')
        .select('lines, sent_at')
        .eq('room_id', 'dm-control-cleared')
        .eq('sender_id', normUser);

      if (!error && Array.isArray(data)) {
        data.forEach((row) => {
          try {
            const raw = Array.isArray(row.lines) ? row.lines[0] : null;
            if (raw) {
              const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
              if (parsed?.clearedAt) {
                const ts = Number(parsed.clearedAt);
                if (parsed.targetRoomId) {
                  localStorage.setItem(`voys_dm_cleared_${normUser}_${parsed.targetRoomId}`, String(ts));
                }
                if (parsed.partnerId) {
                  localStorage.setItem(`voys_dm_cleared_${normUser}_${parsed.partnerId}`, String(ts));
                }
              }
            }
          } catch {}
        });
      }
    } catch (err) {
      console.warn('loadUserDmClearedRecords error:', err);
    }
  },

  // Delete all messages in a DM room or channel
  // - For DMs: Clears ONLY for calling user (tek taraflı silinir, karşı tarafta kalır)
  // - For Channels: Clears completely from DB for all users (komple silinir)
  async deleteChatMessages(roomId, channelId, currentUserId = null, partnerId = null) {
    if (roomId) {
      if (currentUserId) {
        await this.clearDmForUser(currentUserId, partnerId, roomId);
      } else {
        localDb.deleteDmMessages(roomId);
      }
      return true;
    }

    if (channelId) {
      const rawChan = String(channelId || '');
      const cleanChan = rawChan.replace(/^text-/, '');
      const targetIds = Array.from(new Set([rawChan, cleanChan, `text-${cleanChan}`])).filter(Boolean);
      const clearedAt = Date.now();

      // Immediately set cleared timestamp and purge caches
      this.setChannelClearedAt(rawChan, clearedAt);

      if (isSupabaseConfigured && supabase) {
        try {
          const { error } = await supabase.from('channel_messages').delete().in('channel_id', targetIds);
          if (error) {
            console.warn('Supabase delete channel_messages error:', error);
          }
        } catch (err) {
          console.warn('Supabase deleteChatMessages error:', err);
        }
      }
      localDb.deleteChannelMessages(rawChan);
      return true;
    }

    return true;
  },

  // Delete a single message by ID
  async deleteMessage(messageId, roomId, isDm = false) {
    if (!messageId) return false;
    if (isSupabaseConfigured) {
      try {
        const table = isDm ? 'direct_messages' : 'channel_messages';
        const { error } = await supabase.from(table).delete().eq('id', messageId);
        if (error) {
          console.warn(`Supabase deleteMessage error (${table}):`, error);
        }
      } catch (err) {
        console.warn('Supabase deleteMessage exception:', err);
      }
    }
    if (isDm) {
      localDb.deleteSingleDmMessage(roomId, messageId);
    } else {
      localDb.deleteSingleChannelMessage(roomId, messageId);
    }
    return true;
  },

  // Reaction Toggle Operations
  async toggleReaction({ roomId, messageId, emoji, userId, userName = '', isDm = false }) {
    if (isSupabaseConfigured) {
      try {
        const table = isDm ? 'direct_messages' : 'channel_messages';
        const { data: current } = await supabase
          .from(table)
          .select('reactions')
          .eq('id', messageId)
          .single();

        let reactions = [];
        if (current?.reactions) {
          reactions = typeof current.reactions === 'string' ? JSON.parse(current.reactions) : current.reactions;
        }

        const reactIdx = reactions.findIndex((r) => r.emoji === emoji);
        if (reactIdx > -1) {
          const existing = reactions[reactIdx];
          const users = existing.users || [];
          const uIdx = users.indexOf(userId);
          if (uIdx > -1) {
            users.splice(uIdx, 1);
            if (users.length === 0) {
              reactions.splice(reactIdx, 1);
            } else {
              existing.users = users;
              existing.count = users.length;
            }
          } else {
            users.push(userId);
            existing.users = users;
            existing.count = users.length;
          }
        } else {
          reactions.push({ emoji, count: 1, users: [userId] });
        }

        await supabase
          .from(table)
          .update({ reactions: JSON.stringify(reactions) })
          .eq('id', messageId);
      } catch (err) {
        console.warn('Supabase reaction update warning:', err);
      }
    }
    return localDb.toggleReaction({ roomId, messageId, emoji, userId, userName, isDm });
  },

  // File & Media Storage Operations
  async uploadFile(file, pathPrefix = 'chat') {
    if (!file) throw new Error('Yüklenecek dosya seçilmedi');

    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).substring(2, 7)}-${cleanFileName}`;

    if (isSupabaseConfigured) {
      try {
        let uploadResult = await supabase.storage
          .from('chat-attachments')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        // If bucket does not exist, attempt to auto-create and retry
        if (uploadResult.error && uploadResult.error.message?.toLowerCase().includes('not found')) {
          try {
            await supabase.storage.createBucket('chat-attachments', { public: true });
            uploadResult = await supabase.storage
              .from('chat-attachments')
              .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false,
              });
          } catch (createErr) {
            console.warn('Auto-create bucket failed:', createErr);
          }
        }

        if (!uploadResult.error && uploadResult.data) {
          const { data: urlData } = supabase.storage
            .from('chat-attachments')
            .getPublicUrl(filePath);

          return {
            id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            name: file.name,
            size: file.size,
            type: file.type || 'application/octet-stream',
            url: urlData.publicUrl,
          };
        } else if (uploadResult.error) {
          console.warn('Supabase storage upload error:', uploadResult.error.message);
        }
      } catch (err) {
        console.warn('Supabase storage upload error, falling back to local object:', err);
      }
    }

    // Local / Offline fallback
    return new Promise((resolve) => {
      if (file.size > 5 * 1024 * 1024 || file.type.startsWith('video/')) {
        const objUrl = URL.createObjectURL(file);
        resolve({
          id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: file.name,
          size: file.size,
          type: file.type,
          url: objUrl,
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: file.name,
          size: file.size,
          type: file.type,
          url: reader.result,
        });
      };
      reader.onerror = () => {
        resolve({
          id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: file.name,
          size: file.size,
          type: file.type,
          url: URL.createObjectURL(file),
        });
      };
      reader.readAsDataURL(file);
    });
  },

  // Avatar Storage Upload
  async uploadAvatar(file, userId) {
    if (!file) throw new Error('Yüklenecek dosya seçilmedi.');

    // Always compress image client-side to max 400x400 WebP to ensure fast uploads (< 40KB)
    let processedFile = file;
    try {
      processedFile = await compressAvatarImage(file, 400, 0.85);
    } catch (compressErr) {
      console.warn('compressAvatarImage warning:', compressErr);
    }

    if (isSupabaseConfigured) {
      try {
        const fileExt = processedFile.name ? (processedFile.name.split('.').pop() || 'webp') : 'webp';
        const fileName = `${userId || 'anon'}_${Date.now()}.${fileExt}`;
        const filePath = `${userId || 'general'}/${fileName}`;

        // Attempt upload to 'avatars' bucket with 15s timeout
        const uploadPromise = supabase.storage
          .from('avatars')
          .upload(filePath, processedFile, {
            cacheControl: '3600',
            upsert: true,
            contentType: processedFile.type || 'image/webp',
          });

        const { data, error: uploadError } = await withTimeout(
          uploadPromise,
          15000,
          'Storage yüklemesi zaman aşımına uğradı.'
        );

        if (!uploadError && data) {
          const { data: publicUrlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

          if (publicUrlData?.publicUrl) {
            // Append cache buster so avatar updates immediately without reload
            return `${publicUrlData.publicUrl}?t=${Date.now()}`;
          }
        } else if (uploadError) {
          console.warn('Supabase storage avatars upload warning:', uploadError.message);
        }
      } catch (err) {
        console.warn('Supabase uploadAvatar exception, falling back to data URL:', err);
      }
    }

    // High performance fallback (Compressed Data URL - only ~20-40KB)
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(URL.createObjectURL(processedFile));
      reader.readAsDataURL(processedFile);
    });
  },

  // Download file helper (forces browser download with correct file name & detects expired 404 assets)
  async downloadFile(url, fileName = 'download') {
    if (!url) return { ok: false };
    try {
      const response = await fetch(url);
      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          expired: response.status === 404 || response.status === 400,
        };
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      return { ok: true };
    } catch {
      return { ok: false, expired: true };
    }
  },

  // Immediately delete an old file from a Storage bucket by public URL (ignores data/blob/external URLs)
  async deleteStorageObjectByUrl(bucketName, publicUrl) {
    if (!isSupabaseConfigured || !supabase || !bucketName || !publicUrl) return false;
    const storagePath = extractStoragePath(publicUrl, bucketName);
    if (!storagePath) return false;
    try {
      const { error } = await withTimeout(
        supabase.storage.from(bucketName).remove([storagePath]),
        10000,
        'Eski dosya Storage üzerinden silinirken zaman aşımı.'
      );
      if (error) {
        console.warn(`Supabase remove(${bucketName}/${storagePath}) warning:`, error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn(`Supabase remove(${bucketName}) exception:`, err);
      return false;
    }
  },

  // Ensure user profile exists in Supabase DB and localDb
  async ensureProfile(user, metadata = {}) {
    if (!user || !user.id) return null;

    const email = user.email || '';
    const emailPrefix = email ? email.split('@')[0] : 'kullanici';
    const rawUsername = (
      user.user_metadata?.username ||
      metadata.username ||
      emailPrefix
    ).trim().toLowerCase().replace(/[^a-z0-9_]/g, '') || 'user';

    const rawDisplayName = (
      user.user_metadata?.display_name ||
      metadata.display_name ||
      metadata.name ||
      emailPrefix
    ).trim() || rawUsername;

    const avatarUrl = user.user_metadata?.avatar_url || metadata.avatar_url || metadata.avatar || '';

    let profileObj = {
      id: user.id,
      username: rawUsername,
      display_name: rawDisplayName,
      name: rawDisplayName,
      avatar_url: avatarUrl,
      avatar: avatarUrl,
      email: email,
      status: 'online',
      substatus: 'Çevrimiçi',
    };

    if (isSupabaseConfigured) {
      try {
        const { data: existing } = await withTimeout(
          supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle(),
          15000
        );

        if (existing) {
          profileObj = {
            id: existing.id,
            username: existing.username || rawUsername,
            display_name: existing.display_name || rawDisplayName,
            name: existing.display_name || rawDisplayName,
            avatar_url: existing.avatar_url || avatarUrl,
            avatar: existing.avatar_url || avatarUrl,
            email: existing.email || email,
            status: existing.status || 'online',
            substatus: existing.substatus || 'Çevrimiçi',
            game: existing.game || '',
          };

          const updateFields = {};
          if (!existing.username && rawUsername) updateFields.username = rawUsername;
          if (!existing.display_name && rawDisplayName) updateFields.display_name = rawDisplayName;
          if (Object.keys(updateFields).length > 0) {
            try {
              await supabase.from('profiles').update(updateFields).eq('id', user.id);
            } catch {}
          }
        } else {
          const insertPayload = {
            id: user.id,
            username: rawUsername,
            display_name: rawDisplayName,
            avatar_url: avatarUrl,
            status: 'online',
            substatus: 'Çevrimiçi',
            updated_at: new Date().toISOString(),
          };

          const { data: inserted, error: insertError } = await supabase
            .from('profiles')
            .upsert(insertPayload)
            .select()
            .maybeSingle();

          if (insertError?.code === '23503') {
            console.warn('ensureProfile aborted: auth user no longer exists (23503)');
            return null;
          }

          if (inserted) {
            profileObj = {
              id: inserted.id,
              username: inserted.username || rawUsername,
              display_name: inserted.display_name || rawDisplayName,
              name: inserted.display_name || rawDisplayName,
              avatar_url: inserted.avatar_url,
              avatar: inserted.avatar_url,
              email: email,
              status: inserted.status || 'online',
              substatus: inserted.substatus || 'Çevrimiçi',
              game: inserted.game || '',
            };
          }
        }
      } catch (err) {
        console.warn('ensureProfile Supabase error:', err);
      }
    }

    // Always update local database as well
    const localUsers = localDb.getUsers();
    const existingLocal = localUsers.find((u) => u.id === user.id);
    if (!existingLocal) {
      localDb.saveUsers([...localUsers, { ...profileObj, password: '' }]);
    } else {
      localDb.updateUser(user.id, profileObj);
    }

    return profileObj;
  },

  // Update User Profile in Supabase DB and Realtime
  async updateUserProfile(userId, profileData) {
    if (!userId) throw new Error('Kullanıcı kimliği bulunamadı.');

    const updatePayload = {
      updated_at: new Date().toISOString(),
    };

    if (profileData.name !== undefined || profileData.display_name !== undefined) {
      updatePayload.display_name = profileData.display_name || profileData.name;
    }
    if (profileData.username !== undefined) {
      updatePayload.username = (profileData.username || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '') || 'user';
    }
    if (profileData.avatar !== undefined || profileData.avatar_url !== undefined) {
      updatePayload.avatar_url = profileData.avatar_url !== undefined ? profileData.avatar_url : profileData.avatar;
    }
    if (profileData.game !== undefined) {
      updatePayload.game = profileData.game;
    }
    if (profileData.substatus !== undefined || profileData.custom_status !== undefined) {
      updatePayload.substatus = profileData.substatus !== undefined ? profileData.substatus : profileData.custom_status;
    }
    if (profileData.status !== undefined) {
      updatePayload.status = profileData.status;
    }

    let returnedProfile = { id: userId, ...profileData };

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await withTimeout(
          supabase
            .from('profiles')
            .update(updatePayload)
            .eq('id', userId)
            .select()
            .maybeSingle(),
          8000,
          'Profil güncelleme zaman aşımına uğradı.'
        );

        if (!error && data) {
          returnedProfile = {
            id: data.id,
            name: data.display_name || data.username,
            username: data.username,
            avatar: data.avatar_url,
            game: data.game,
            substatus: data.substatus,
            status: data.status,
            email: data.email,
          };
        } else if (error) {
          console.warn('Supabase updateUserProfile error:', error.message);
        }
      } catch (err) {
        console.warn('Supabase updateUserProfile exception:', err);
      }
    }

    // Always update local database as well
    localDb.updateUser(userId, {
      display_name: updatePayload.display_name,
      username: updatePayload.username,
      avatar_url: updatePayload.avatar_url,
      game: updatePayload.game,
      substatus: updatePayload.substatus,
      status: updatePayload.status,
    });

    return returnedProfile;
  },

  // Fetch single user profile
  async fetchUserProfile(userId) {
    if (!userId) return null;
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await withTimeout(
          supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle(),
          8000,
          'Kullanıcı profili alınırken zaman aşımı oluştu.'
        );
        if (!error && data) {
          const resolvedName = pickDisplayName([data.display_name, data.username], null);
          const profileObj = {
            id: data.id,
            name: resolvedName,
            display_name: resolvedName,
            username: data.username,
            avatar: data.avatar_url,
            avatar_url: data.avatar_url,
            game: data.game,
            substatus: data.substatus,
            status: data.status,
            email: data.email,
          };
          cacheUserProfiles([profileObj]);
          return profileObj;
        }
      } catch (err) {
        console.warn('fetchUserProfile error:', err);
      }
    }
    const localUsers = localDb.getUsers();
    const u = localUsers.find((x) => x.id === userId);
    if (u) {
      const localName = pickDisplayName([u.display_name, u.name, u.username], null);
      return {
        id: u.id,
        name: localName,
        display_name: localName,
        username: u.username,
        avatar: u.avatar_url,
        avatar_url: u.avatar_url,
        game: u.game,
        substatus: u.substatus,
        status: u.status,
        email: u.email,
      };
    }
    return getCachedUserProfile(userId);
  },

  // Friends & Profiles Operations
  async fetchFriends() {
    if (isSupabaseConfigured) {
      try {
        const { data: friendsData, error: friendsError } = await supabase
          .from('friends')
          .select('*');
        if (!friendsError && Array.isArray(friendsData) && friendsData.length > 0) {
          return friendsData;
        }

        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, game, substatus, status');
        if (!profilesError && Array.isArray(profilesData)) {
          const { data: authData } = await supabase.auth.getUser();
          const currentId = authData?.user?.id;
          return profilesData
            .filter((p) => p.id !== currentId)
            .map((p) => ({
              id: p.id,
              name: p.display_name || p.username || 'Kullanıcı',
              avatar: p.avatar_url || null,
              game: null,
              substatus: '',
              status: 'offline',
              isOnline: false,
              isAway: false,
            }));
        }
      } catch (err) {
        console.warn('Supabase fetchFriends error:', err);
      }
    }
    return localDb.getFriends();
  },

  // User Search Operations (by username or display name)
  async searchUsers(query, currentUserId) {
    let rawQuery = (query || '').trim();
    if (rawQuery.startsWith('@')) {
      rawQuery = rawQuery.slice(1).trim();
    }
    if (!rawQuery) return [];

    const namePart = rawQuery.includes('#') ? rawQuery.split('#')[0].trim() : rawQuery;
    const cleanName = namePart.replace(/İ/g, 'i').toLowerCase().replace(/[(),]/g, '');
    if (!cleanName) return [];

    const foundMap = new Map();
    let supabaseSearchError = null;

    // 1. Search in Supabase profiles if configured
    if (isSupabaseConfigured) {
      try {
        const filterStr = `username.ilike.%${cleanName}%,display_name.ilike.%${cleanName}%`;
        const { data, error } = await withTimeout(
          supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url, status, substatus')
            .or(filterStr)
            .limit(15),
          8000,
          'Kullanıcı araması zaman aşımına uğradı.'
        );

        if (error) {
          throw new Error(error.message || 'Kullanıcı araması başarısız oldu.');
        }

        if (Array.isArray(data)) {
          cacheUserProfiles(data);
          data.forEach((u) => {
            if (u.id !== currentUserId) {
              foundMap.set(u.id, {
                id: u.id,
                name: pickDisplayName([u.display_name, u.username], 'Kullanıcı'),
                username: (!isUuidLike(u.username) && u.username) || 'user',
                avatar: u.avatar_url,
                status: u.status || 'offline',
              });
            }
          });
        }
      } catch (err) {
        supabaseSearchError = err;
        console.warn('Supabase searchUsers error:', err);
      }
    }

    // 2. Also search local database (covers offline mode, other test accounts, rate-limited users)
    const localUsers = localDb.getUsers();
    localUsers.forEach((u) => {
      if (u.id !== currentUserId && !foundMap.has(u.id)) {
        const uName = (u.username || '').replace(/İ/g, 'i').toLowerCase();
        const uDisp = (u.display_name || '').replace(/İ/g, 'i').toLowerCase();

        if (uName.includes(cleanName) || uDisp.includes(cleanName)) {
          foundMap.set(u.id, {
            id: u.id,
            name: pickDisplayName([u.display_name, u.username], 'Kullanıcı'),
            username: (!isUuidLike(u.username) && u.username) || 'user',
            avatar: u.avatar_url,
            status: u.status || 'offline',
          });
        }
      }
    });

    if (foundMap.size === 0 && supabaseSearchError) {
      throw new Error(supabaseSearchError.message || 'Kullanıcı araması sırasında sunucuya ulaşılamadı. Lütfen tekrar deneyin.');
    }

    return Array.from(foundMap.values());
  },

  // Friendship Operations
  async sendFriendRequest(currentUserId, targetQueryOrId) {
    if (!currentUserId || currentUserId === 'you' || !targetQueryOrId) {
      throw new Error('Eksik veya geçersiz kullanıcı bilgisi.');
    }

    let targetUserId = targetQueryOrId;

    if (!isUuidLike(String(targetQueryOrId))) {
      const found = await this.searchUsers(targetQueryOrId, currentUserId);
      if (!found || found.length === 0) {
        throw new Error('Kullanıcı bulunamadı. Lütfen kullanıcı adını kontrol edin.');
      }
      targetUserId = found[0].id;
    }

    if (targetUserId === currentUserId) {
      throw new Error('Kendinize arkadaşlık isteği gönderemezsiniz.');
    }

    if (isSupabaseConfigured) {
      let friendshipsTableAvailable = true;
      try {
        const pairFilter = `and(user_id.eq.${currentUserId},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${currentUserId})`;
        const { data: existing, error: existErr } = await withTimeout(
          supabase
            .from('friendships')
            .select('*')
            .or(pairFilter),
          8000,
          'Arkadaşlık durumu kontrol edilirken zaman aşımı oluştu.'
        );

        if (existErr) {
          if (isMissingRelationError(existErr)) {
            friendshipsTableAvailable = false;
          } else {
            throw existErr;
          }
        } else if (existing && existing.length > 0) {
          existing.forEach((f) => throwIfFriendshipConflict(f, currentUserId));

          const rejectedIds = existing
            .filter((f) => String(f.status || '').toLowerCase() === 'rejected')
            .map((f) => f.id)
            .filter(Boolean);

          if (rejectedIds.length > 0) {
            const { error: delErr } = await withTimeout(
              supabase
                .from('friendships')
                .delete()
                .in('id', rejectedIds),
              8000,
              'Önceki istek temizlenirken zaman aşımı oluştu.'
            );
            if (delErr) throw delErr;
          }
        }

        if (friendshipsTableAvailable) {
          const { data, error } = await withTimeout(
            supabase
              .from('friendships')
              .insert([
                {
                  user_id: currentUserId,
                  friend_id: targetUserId,
                  status: 'pending',
                },
              ])
              .select()
              .single(),
            8000,
            'Arkadaşlık isteği gönderilirken zaman aşımı oluştu.'
          );

          if (error) {
            if (isMissingRelationError(error)) {
              friendshipsTableAvailable = false;
            } else if (String(error.code || '') === '23505') {
              const { data: latest } = await withTimeout(
                supabase
                  .from('friendships')
                  .select('*')
                  .or(pairFilter),
                5000
              );
              if (latest && latest.length > 0) {
                latest.forEach((f) => throwIfFriendshipConflict(f, currentUserId));
              }
              throw createFriendshipError('Bekleyen bir arkadaşlık isteği zaten mevcut.', 'PENDING_OUTGOING');
            } else {
              throw error;
            }
          } else {
            return data;
          }
        }
      } catch (err) {
        if (err?.code === 'ALREADY_FRIENDS' || err?.code === 'PENDING_INCOMING' || err?.code === 'PENDING_OUTGOING' || err?.code === 'BLOCKED') {
          throw err;
        }
        if (err?.message && (err.message.includes('zaten') || err.message.includes('Kendinize') || err.message.includes('bulunamadı'))) {
          throw err;
        }
        if (isMissingRelationError(err)) {
          friendshipsTableAvailable = false;
        } else {
          throw new Error(err?.message || 'Arkadaşlık isteği gönderilirken sunucu hatası oluştu. Lütfen tekrar deneyin.');
        }
      }

      // Realtime Bridge via direct_messages if friendships table is not yet created in Supabase
      if (!friendshipsTableAvailable) {
        const { data: existingDm, error: dmSelectErr } = await withTimeout(
          supabase
            .from('direct_messages')
            .select('*')
            .eq('room_id', 'dm-friendship-requests')
            .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${currentUserId})`),
          8000,
          'Arkadaşlık istekleri kontrol edilirken zaman aşımı oluştu.'
        );

        if (dmSelectErr) {
          throw new Error(dmSelectErr.message || 'Arkadaşlık isteği gönderilemedi.');
        }

        if (existingDm && existingDm.length > 0) {
          existingDm.forEach((last) => {
            const statusLine = (last.lines && last.lines[0]) || '';
            const status = statusLine.includes('accepted')
              ? 'accepted'
              : statusLine.includes('pending')
                ? 'pending'
                : 'rejected';
            throwIfFriendshipConflict({ ...last, status }, currentUserId);
          });
        }

        const reqId = `fr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const { data: dmData, error: dmErr } = await withTimeout(
          supabase
            .from('direct_messages')
            .insert([
              {
                id: reqId,
                room_id: 'dm-friendship-requests',
                sender_id: currentUserId,
                receiver_id: targetUserId,
                sender_name: 'Voys',
                lines: ['__FRIEND_REQUEST:pending__'],
                attachments: [],
              },
            ])
            .select()
            .single(),
          8000,
          'Arkadaşlık isteği gönderilirken zaman aşımı oluştu.'
        );

        if (dmErr || !dmData) {
          throw new Error(dmErr?.message || 'Arkadaşlık isteği gönderilirken hata oluştu.');
        }

        return {
          id: dmData.id,
          user_id: currentUserId,
          friend_id: targetUserId,
          status: 'pending',
        };
      }

      throw new Error('Arkadaşlık isteği gönderilemedi. Lütfen tekrar deneyin.');
    }

    // Local fallback (offline / unconfigured mode only)
    const list = localDb.getFriendships();
    const existing = list.find((f) =>
      (f.user_id === currentUserId && f.friend_id === targetUserId) ||
      (f.user_id === targetUserId && f.friend_id === currentUserId)
    );
    if (existing) {
      throwIfFriendshipConflict(existing, currentUserId);
      const filtered = list.filter((f) => f.id !== existing.id);
      const refreshed = {
        id: `f-${Date.now()}`,
        user_id: currentUserId,
        friend_id: targetUserId,
        status: 'pending',
        created_at: new Date().toISOString(),
      };
      filtered.push(refreshed);
      localDb.saveFriendships(filtered);
      return refreshed;
    }

    const newF = {
      id: `f-${Date.now()}`,
      user_id: currentUserId,
      friend_id: targetUserId,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    list.push(newF);
    localDb.saveFriendships(list);
    return newF;
  },

  async fetchFriendships(currentUserId) {
    if (!currentUserId || currentUserId === 'you') {
      return { friends: [], incoming: [], outgoing: [] };
    }

    if (isSupabaseConfigured) {
      let rows = null;
      let missingTable = false;

      // 1. Try friendships table
      const { data, error } = await withTimeout(
        supabase
          .from('friendships')
          .select('*')
          .or(`user_id.eq.${currentUserId},friend_id.eq.${currentUserId}`),
        8000,
        'Arkadaş listesi alınırken zaman aşımı oluştu.'
      );
      if (error) {
        if (isMissingRelationError(error)) {
          missingTable = true;
        } else {
          throw error;
        }
      } else if (Array.isArray(data)) {
        rows = data;
      }

      // 2. Fallback to direct_messages bridge if friendships table is not present
      if (!rows && missingTable) {
        try {
          const { data: dmRows, error: dmErr } = await withTimeout(
            supabase
              .from('direct_messages')
              .select('*')
              .eq('room_id', 'dm-friendship-requests')
              .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`),
            8000,
            'Arkadaşlık istekleri alınırken zaman aşımı oluştu.'
          );

          if (!dmErr && Array.isArray(dmRows)) {
            rows = dmRows.map((dm) => {
              const statusLine = (dm.lines && dm.lines[0]) || '';
              const status = statusLine.includes('accepted') ? 'accepted' : 'pending';
              return {
                id: dm.id,
                user_id: dm.sender_id,
                friend_id: dm.receiver_id,
                status,
                created_at: dm.created_at,
              };
            });
          }
        } catch (dmErr) {
          console.warn('DM bridge fetch warning:', dmErr);
        }
      }

      if (Array.isArray(rows)) {
        const otherIds = rows.map((r) => r.user_id === currentUserId ? r.friend_id : r.user_id);
        let profileMap = new Map();

        if (otherIds.length > 0) {
          try {
            const { data: profiles } = await withTimeout(
              supabase
                .from('profiles')
                .select('id, username, display_name, avatar_url, game, substatus, status')
                .in('id', otherIds),
              8000,
              'Arkadaş profilleri alınırken zaman aşımı oluştu.'
            );

            if (profiles) {
              cacheUserProfiles(profiles);
              profileMap = new Map(profiles.map((p) => [p.id, p]));
            }
          } catch (profErr) {
            console.warn('Friend profiles fetch warning:', profErr);
          }
        }

        // Also enrich with localDb profiles for avatars
        try {
          const localUsers = localDb.getUsers();
          localUsers.forEach((lu) => {
            if (lu?.id && !profileMap.has(lu.id)) {
              profileMap.set(lu.id, lu);
            } else if (lu?.id && profileMap.has(lu.id)) {
              const existing = profileMap.get(lu.id);
              if (!existing.avatar_url && (lu.avatar_url || lu.avatar)) {
                existing.avatar_url = lu.avatar_url || lu.avatar;
              }
            }
          });
        } catch {}

        const friends = [];
        const incoming = [];
        const outgoing = [];

        rows.forEach((r) => {
          const otherId = r.user_id === currentUserId ? r.friend_id : r.user_id;
          const cached = getCachedUserProfile(otherId);
          const prof = profileMap.get(otherId) || cached || {
            id: otherId,
            username: 'user',
            display_name: 'Kullanıcı',
            status: 'offline',
          };

          const resolvedAvatar = prof.avatar_url || prof.avatar || cached?.avatar_url || cached?.avatar || null;
          const resolvedName = pickDisplayName(
            [prof.display_name, prof.name, prof.username, cached?.display_name, cached?.name, cached?.username],
            'Kullanıcı'
          );

          const friendItem = {
            friendshipId: r.id,
            id: otherId,
            name: resolvedName,
            display_name: resolvedName,
            username: (!isUuidLike(prof.username) && prof.username) || cached?.username || 'user',
            avatar: resolvedAvatar,
            avatar_url: resolvedAvatar,
            game: null,
            substatus: '',
            status: 'offline',
            isOnline: false,
            isAway: false,
            created_at: r.created_at,
          };

          if (r.status === 'accepted') {
            friends.push(friendItem);
          } else if (r.status === 'pending') {
            if (r.friend_id === currentUserId) {
              incoming.push(friendItem);
            } else {
              outgoing.push(friendItem);
            }
          }
        });

        return { friends, incoming, outgoing };
      }
    }

    // Local fallback
    const list = localDb.getFriendships().filter((f) => f.user_id === currentUserId || f.friend_id === currentUserId);
    const users = localDb.getUsers();
    const userMap = new Map(users.map((u) => [u.id, u]));

    const friends = [];
    const incoming = [];
    const outgoing = [];

    list.forEach((r) => {
      const otherId = r.user_id === currentUserId ? r.friend_id : r.user_id;
      const u = userMap.get(otherId) || { id: otherId, name: 'Kullanıcı', username: 'user' };
      const item = {
        friendshipId: r.id,
        id: otherId,
        name: u.display_name || u.username || 'Kullanıcı',
        username: u.username,
        avatar: u.avatar_url || null,
        game: null,
        substatus: '',
        status: 'offline',
        isOnline: false,
        isAway: false,
      };

      if (r.status === 'accepted') {
        friends.push(item);
      } else if (r.status === 'pending') {
        if (r.friend_id === currentUserId) incoming.push(item);
        else outgoing.push(item);
      }
    });

    return { friends, incoming, outgoing };
  },

  async acceptFriendRequest(friendshipId) {
    if (!friendshipId) {
      throw new Error('Geçersiz arkadaşlık isteği.');
    }

    if (isSupabaseConfigured) {
      if (typeof friendshipId === 'string' && friendshipId.startsWith('fr-')) {
        const { error } = await withTimeout(
          supabase
            .from('direct_messages')
            .update({ lines: ['__FRIEND_REQUEST:accepted__'] })
            .eq('id', friendshipId),
          8000,
          'Arkadaşlık isteği onaylanırken zaman aşımı oluştu.'
        );
        if (error) {
          throw new Error(error.message || 'Arkadaşlık isteği onaylanamadı.');
        }
        return { id: friendshipId, status: 'accepted' };
      }

      const { data, error } = await withTimeout(
        supabase
          .from('friendships')
          .update({ status: 'accepted', updated_at: new Date().toISOString() })
          .eq('id', friendshipId)
          .select()
          .maybeSingle(),
        8000,
        'Arkadaşlık isteği onaylanırken zaman aşımı oluştu.'
      );
      if (error) {
        throw new Error(error.message || 'Arkadaşlık isteği onaylanamadı.');
      }
      if (!data) {
        throw new Error('Arkadaşlık isteği bulunamadı veya zaten işlenmiş.');
      }
      return data;
    }

    const list = localDb.getFriendships();
    const item = list.find((f) => f.id === friendshipId);
    if (item) {
      item.status = 'accepted';
      localDb.saveFriendships(list);
    }
    return item;
  },

  async rejectFriendRequest(friendshipId) {
    if (!friendshipId) {
      throw new Error('Geçersiz arkadaşlık isteği.');
    }

    if (isSupabaseConfigured) {
      if (typeof friendshipId === 'string' && friendshipId.startsWith('fr-')) {
        const { error } = await withTimeout(
          supabase
            .from('direct_messages')
            .delete()
            .eq('id', friendshipId),
          8000,
          'Arkadaşlık isteği kaldırılırken zaman aşımı oluştu.'
        );
        if (error) {
          throw new Error(error.message || 'Arkadaşlık isteği kaldırılamadı.');
        }
        return true;
      }

      const { error } = await withTimeout(
        supabase
          .from('friendships')
          .delete()
          .eq('id', friendshipId),
        8000,
        'Arkadaşlık isteği kaldırılırken zaman aşımı oluştu.'
      );
      if (error) {
        throw new Error(error.message || 'Arkadaşlık isteği kaldırılamadı.');
      }
      return true;
    }

    const list = localDb.getFriendships().filter((f) => f.id !== friendshipId);
    localDb.saveFriendships(list);
    return true;
  },

  // Realtime Subscriptions with single persistent channel per table + auto recovery
  subscribeToTable(table, callback) {
    if (isSupabaseConfigured && supabase) {
      ensureRealtimeLifecycleListeners();
      if (!sharedTableListeners.has(table)) {
        sharedTableListeners.set(table, new Set());
      }
      sharedTableListeners.get(table).add(callback);

      if (!sharedSupabaseChannels.has(table)) {
        createSharedTableChannel(table);
      }

      return () => {
        const listeners = sharedTableListeners.get(table);
        if (listeners) {
          listeners.delete(callback);
          if (listeners.size === 0) {
            const timer = sharedReconnectTimers.get(table);
            if (timer) {
              clearTimeout(timer);
              sharedReconnectTimers.delete(table);
            }
            const channel = sharedSupabaseChannels.get(table);
            if (channel) {
              try {
                supabase.removeChannel(channel);
              } catch {}
              sharedSupabaseChannels.delete(table);
            }
            sharedChannelStatuses.delete(table);
            sharedReconnectAttempts.delete(table);
            notifyRealtimeHealth();
          }
        }
      };
    }
    return localDb.subscribe(table, callback);
  },

  subscribeToChannelMessages(channelId, callback) {
    if (isSupabaseConfigured && supabase) {
      ensureRealtimeLifecycleListeners();
      const uniqueTopic = `room_chan_${channelId}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const channel = supabase
        .channel(uniqueTopic)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'channel_messages',
            filter: `channel_id=eq.${channelId}`,
          },
          (payload) => callback(payload)
        )
        .subscribe((status, err) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            if (err) console.warn(`[Realtime channel ${channelId}] warning:`, err);
            realtimeHealthState.lastError = err?.message || status;
          }
          notifyRealtimeHealth();
        });

      directRoomChannels.add(channel);
      notifyRealtimeHealth();

      return () => {
        directRoomChannels.delete(channel);
        try {
          supabase.removeChannel(channel);
        } catch {}
        notifyRealtimeHealth();
      };
    }
    return localDb.subscribe('channel_messages', (payload) => {
      if (payload.channelId === channelId || !payload.channelId) {
        callback(payload);
      }
    });
  },

  subscribeToDmMessages(roomId, callback) {
    if (isSupabaseConfigured && supabase) {
      ensureRealtimeLifecycleListeners();
      const uniqueTopic = `room_dm_${roomId}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const channel = supabase
        .channel(uniqueTopic)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'direct_messages',
            filter: `room_id=eq.${roomId}`,
          },
          (payload) => callback(payload)
        )
        .subscribe((status, err) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            if (err) console.warn(`[Realtime DM ${roomId}] warning:`, err);
            realtimeHealthState.lastError = err?.message || status;
          }
          notifyRealtimeHealth();
        });

      directRoomChannels.add(channel);
      notifyRealtimeHealth();

      return () => {
        directRoomChannels.delete(channel);
        try {
          supabase.removeChannel(channel);
        } catch {}
        notifyRealtimeHealth();
      };
    }
    return localDb.subscribe('direct_messages', (payload) => {
      if (payload.roomId === roomId || !payload.roomId) {
        callback(payload);
      }
    });
  },

  getRealtimeHealth() {
    return getRealtimeHealthSnapshot();
  },

  subscribeRealtimeHealth(callback) {
    if (typeof callback !== 'function') return () => {};
    realtimeHealthListeners.add(callback);
    try {
      callback(getRealtimeHealthSnapshot());
    } catch {}
    return () => {
      realtimeHealthListeners.delete(callback);
    };
  },

  onRealtimeRecovered(callback) {
    if (typeof callback !== 'function') return () => {};
    realtimeRecoveredListeners.add(callback);
    return () => {
      realtimeRecoveredListeners.delete(callback);
    };
  },

  reconnectRealtime(reason = 'manual') {
    return reconnectAllSharedChannels(reason);
  },

  // Admin-only Telemetry & Cleanup Edge Function APIs
  async fetchAdminTelemetry() {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase yapılandırılmamış.');
    }
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.access_token) {
      throw new Error('Yönetici oturumu bulunamadı.');
    }
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const { data, error } = await withTimeout(
      supabase.functions.invoke('admin-telemetry', {
        body: { requestedAt: new Date().toISOString() },
      }),
      15000,
      'Sistem izleme verileri alınırken zaman aşımı oluştu.'
    );
    if (error) {
      throw new Error(await unwrapFunctionError(error, 'Sistem izleme verileri alınamadı.'));
    }
    const elapsed = typeof performance !== 'undefined' ? performance.now() - startedAt : 0;
    return {
      ...data,
      client_roundtrip_ms: Math.round(elapsed),
    };
  },

  async runStorageCleanupNow({ maxAgeHours = 48, dryRun = false } = {}) {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase yapılandırılmamış.');
    }
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.access_token) {
      throw new Error('Yönetici oturumu bulunamadı.');
    }
    const { data, error } = await withTimeout(
      supabase.functions.invoke('storage-cleanup', {
        body: { source: 'admin_ui', maxAgeHours, dryRun },
      }),
      25000,
      'Depolama temizliği zaman aşımına uğradı.'
    );
    if (error) {
      throw new Error(await unwrapFunctionError(error, 'Depolama temizliği çalıştırılamadı.'));
    }
    return data;
  },

  purgeLocalUserData(userId) {
    return localDb.purgeUserData(userId);
  },

  async deleteUserAccount(userId) {
    const cleanId = typeof userId === 'string' ? userId.trim() : '';
    if (!cleanId) {
      throw new Error('Silinecek kullanıcı ID geçersiz.');
    }
    if (isProtectedAdminIdentity(cleanId) || cleanId.toLowerCase() === ADMIN_USER_ID) {
      throw new Error('Ana yönetici hesabı silinemez.');
    }

    if (isSupabaseConfigured && supabase) {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) {
        throw new Error('Yönetici oturumu bulunamadı.');
      }
      const { data, error } = await withTimeout(
        supabase.functions.invoke('admin-delete-user', {
          body: { userId: cleanId },
        }),
        25000,
        'Kullanıcı silme işlemi zaman aşımına uğradı.'
      );
      if (error) {
        throw new Error(await unwrapFunctionError(error, 'Kullanıcı hesabı silinemedi.'));
      }
      localDb.purgeUserData(cleanId);
      return data;
    }

    const summary = localDb.purgeUserData(cleanId);
    return {
      success: true,
      userId: cleanId,
      localOnly: true,
      summary,
    };
  },
};

export default supabase;
