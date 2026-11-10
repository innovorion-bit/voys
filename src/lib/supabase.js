import { createClient } from '@supabase/supabase-js';
import { compressAvatarImage } from '../utils/imageCompressor';

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
export const getDmRoomId = (user1Id, user2Id) => {
  if (!user1Id || !user2Id) {
    return `dm-${user2Id || user1Id || 'unknown'}`;
  }
  const [first, second] = [String(user1Id), String(user2Id)].sort();
  return `dm-${first}--${second}`;
};

// Timeout wrapper helper to prevent network requests from hanging indefinitely
export const withTimeout = (promise, ms = 25000, errorMsg = 'Sunucu yanıt vermedi (Zaman aşımı).') => {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      const timer = setTimeout(() => {
        const err = new Error(errorMsg);
        err.name = 'TimeoutError';
        err.isNetworkOrTimeout = true;
        reject(err);
      }, ms);
      if (promise && typeof promise.then === 'function') {
        promise.finally(() => clearTimeout(timer)).catch(() => {});
      }
    }),
  ]);
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
    const tag = (options?.data?.tag || String(Math.floor(1000 + Math.random() * 9000))).toString().replace(/[^0-9]/g, '').slice(0, 4) || '0001';

    const newUser = {
      id: `user-${Date.now().toString(36)}`,
      email: safeEmail || `${emailPrefix}@standupp.local`,
      password,
      username: cleanUsername,
      tag,
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
        tag: '1001',
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

  getChannels() {
    const list = this.getItem('standupp_db_channels', []);
    return list.filter((c) => c && c.id !== 'home' && c.id !== 'voice-sesli-sohbet' && !c.is_home);
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
    return all[channelId] || [];
  }

  saveChannelMessages(channelId, messages) {
    const all = this.getItem('standupp_db_channel_msgs', {});
    all[channelId] = messages;
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

  getDmMessages(roomId) {
    const all = this.getItem('standupp_db_dm_msgs', {});
    if (all[roomId]) return all[roomId];
    if (roomId && roomId.startsWith('dm-')) {
      const parts = roomId.replace(/^dm-/, '').split('--');
      if (parts.length === 2) {
        const alt = `dm-${parts[1]}--${parts[0]}`;
        const legacy1 = `dm-${parts[0]}`;
        const legacy2 = `dm-${parts[1]}`;
        return all[alt] || all[legacy1] || all[legacy2] || [];
      }
    }
    return [];
  }

  saveDmMessages(roomId, messages) {
    const all = this.getItem('standupp_db_dm_msgs', {});
    all[roomId] = messages;
    this.setItem('standupp_db_dm_msgs', all);
  }

  addDmMessage(roomId, message) {
    const all = this.getItem('standupp_db_dm_msgs', {});
    const list = all[roomId] || [];
    const updated = [...list, message];
    all[roomId] = updated;
    this.setItem('standupp_db_dm_msgs', all);
    this.notifyTable('direct_messages', { eventType: 'INSERT', new: message, roomId });
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
    delete all[channelId];
    this.setItem('standupp_db_channel_msgs', all);
    this.notifyTable('channel_messages', { eventType: 'DELETE', channelId });
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
}

export const localDb = new StanduppLocalEngine();

// Multiplexed Realtime table listeners to ensure a single persistent WebSocket channel per table
const sharedTableListeners = new Map();
const sharedSupabaseChannels = new Map();

// ==============================================================================
// Unified Supabase Data & Service Layer
// ==============================================================================
export const dbService = {
  // Auth Operations
  async signUp(email, password, metadata = {}) {
    const rawUsername = (metadata.username || (email ? email.split('@')[0] : 'kullanici')).trim().toLowerCase().replace(/[^a-z0-9_]/g, '') || 'user';
    const rawDisplayName = (metadata.display_name || metadata.username || rawUsername).trim();
    const tag = (metadata.tag || String(Math.floor(1000 + Math.random() * 9000))).toString().replace(/[^0-9]/g, '').slice(0, 4) || '0001';

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
                  tag: tag,
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
              tag: tag,
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
          tag 
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
        const redirect = redirectTo || (typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined);
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

  // Channels Operations (Only user-created channels)
  async fetchChannels() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('channels')
          .select('*')
          .neq('id', 'home')
          .neq('id', 'voice-sesli-sohbet')
          .neq('is_home', true)
          .order('created_at', { ascending: true });
        if (!error && Array.isArray(data)) {
          return data.filter((c) => c && c.id !== 'home' && c.id !== 'voice-sesli-sohbet' && !c.is_home);
        }
      } catch (err) {
        console.warn('Supabase fetchChannels error:', err);
      }
    }
    return localDb.getChannels();
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
          try {
            await supabase.from('channel_members').insert([
              {
                channel_id: channel.id,
                user_id: channel.created_by,
                role: 'admin',
              },
            ]);
          } catch (memErr) {
            console.warn('Channel member admin insert warning:', memErr);
          }
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
        const { data, error } = await withTimeout(
          supabase
            .from('channels')
            .update(updates)
            .eq('id', channelId)
            .select()
            .single(),
          3500,
          'updateChannel zaman aşımı'
        );
        if (!error && data) {
          result = data;
        }
      } catch (err) {
        console.warn('Supabase updateChannel error:', err);
      }
    }
    return result || localResult;
  },

  // Channel Members Operations
  async fetchChannelMembers(channelId) {
    if (isSupabaseConfigured) {
      try {
        const { data: memberRows, error } = await supabase
          .from('channel_members')
          .select('*')
          .eq('channel_id', channelId);

        if (!error && Array.isArray(memberRows) && memberRows.length > 0) {
          const userIds = memberRows.map((m) => m.user_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url, status, substatus, game')
            .in('id', userIds);

          const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

          return memberRows.map((m) => {
            const prof = profileMap.get(m.user_id) || {};
            const resolvedName = prof.display_name || prof.username || 'Kullanıcı';
            return {
              ...m,
              name: resolvedName,
              username: prof.username || 'user',
              avatar: prof.avatar_url || null,
              avatar_url: prof.avatar_url || null,
              game: prof.game || '',
              substatus: prof.substatus || '',
              status: prof.status || 'offline',
              profile: prof,
              profiles: prof,
            };
          });
        }
      } catch (err) {
        console.warn('Supabase fetchChannelMembers error:', err);
      }
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
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('channel_members')
          .insert([
            {
              channel_id: channelId,
              user_id: userId,
              role,
            },
          ])
          .select()
          .single();

        if (!error && data) return data;
      } catch (err) {
        console.warn('Supabase addChannelMember error:', err);
      }
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

  // Channel Messages Operations
  async fetchMessages(channelId) {
    return this.fetchChannelMessages(channelId);
  },

  async fetchChannelMessages(channelId) {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('channel_messages')
          .select('*')
          .eq('channel_id', channelId)
          .order('sent_at', { ascending: true });

        if (!error && Array.isArray(data)) {
          const mapped = data.map((row) => {
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
              color: row.color || '#90ba3c',
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
          });

          localDb.saveChannelMessages(channelId, mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('Supabase fetchChannelMessages error:', err);
      }
    }
    return localDb.getChannelMessages(channelId);
  },

  async saveChannelMessage(channelId, message) {
    if (isSupabaseConfigured) {
      try {
        const dbRow = {
          id: message.id,
          channel_id: channelId,
          sender_id: message.userId,
          sender_name: message.user,
          sender_avatar: message.avatar || '',
          color: message.color || '#90ba3c',
          has_crown: message.hasCrown || false,
          lines: message.lines || (message.text ? [message.text] : []),
          attachments: message.attachments || [],
          parent_id: message.parent_id || message.parentId || null,
          reply_to: message.reply_to ? JSON.stringify(message.reply_to) : null,
          reactions: message.reactions ? JSON.stringify(message.reactions) : '[]',
          timestamp_text: message.timestamp,
          sent_at: message.sentAt || Date.now(),
        };
        await supabase.from('channel_messages').insert([dbRow]);
      } catch (err) {
        console.warn('Supabase saveChannelMessage error:', err);
      }
    }
    return localDb.addChannelMessage(channelId, message);
  },

  // Direct Messages (DM) Operations
  async fetchDmMessages(roomId, currentUserId = null, otherUserId = null) {
    let user1 = currentUserId;
    let user2 = otherUserId;

    if (user1 === 'undefined' || user1 === 'null' || !user1) user1 = null;
    if (user2 === 'undefined' || user2 === 'null' || !user2) user2 = null;

    if ((!user1 || !user2) && roomId && roomId.startsWith('dm-')) {
      const parts = roomId.replace(/^dm-/, '').split('--');
      if (parts.length === 2) {
        if (!user1) user1 = parts[0];
        if (!user2) user2 = parts[1];
      }
    }

    const canonical = (user1 && user2) ? getDmRoomId(user1, user2) : roomId;

    if (isSupabaseConfigured) {
      try {
        const roomIdsToMatch = Array.from(new Set([
          canonical,
          roomId,
          user1 ? `dm-${user1}` : null,
          user2 ? `dm-${user2}` : null,
        ].filter(Boolean)));

        let { data, error } = await supabase
          .from('direct_messages')
          .select('*')
          .in('room_id', roomIdsToMatch)
          .order('sent_at', { ascending: true });

        // If no messages found by room_id and both participants are known, fallback to sender/receiver query
        if ((!data || data.length === 0) && user1 && user2) {
          const res1 = await supabase
            .from('direct_messages')
            .select('*')
            .eq('sender_id', user1)
            .eq('receiver_id', user2)
            .order('sent_at', { ascending: true });

          const res2 = await supabase
            .from('direct_messages')
            .select('*')
            .eq('sender_id', user2)
            .eq('receiver_id', user1)
            .order('sent_at', { ascending: true });

          const combined = [
            ...(Array.isArray(res1.data) ? res1.data : []),
            ...(Array.isArray(res2.data) ? res2.data : []),
          ];

          if (combined.length > 0) {
            const seen = new Set();
            data = combined
              .filter((item) => {
                if (!item?.id || seen.has(item.id)) return false;
                seen.add(item.id);
                return true;
              })
              .sort((a, b) => (Number(a.sent_at) || 0) - (Number(b.sent_at) || 0));
            error = null;
          }
        }

        if (!error && Array.isArray(data)) {
          // Filter out friendship system requests
          const realMessages = data.filter((row) => 
            row.room_id !== 'dm-friendship-requests' && 
            !(Array.isArray(row.lines) && row.lines[0]?.startsWith('__FRIEND_REQUEST:'))
          );

          const mapped = realMessages.map((row) => {
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
              room_id: row.room_id,
              user: row.sender_name,
              userId: row.sender_id,
              avatar: row.sender_avatar || null,
              color: row.color || '#90ba3c',
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
          });

          // Synchronize localDb cache for offline/instant access
          if (canonical) localDb.saveDmMessages(canonical, mapped);
          if (roomId && roomId !== canonical) localDb.saveDmMessages(roomId, mapped);

          return mapped;
        }
      } catch (err) {
        console.warn('Supabase fetchDmMessages error:', err);
      }
    }

    // Local fallback: try canonical first, then roomId
    const localCanonical = canonical ? localDb.getDmMessages(canonical) : [];
    if (localCanonical.length > 0) return localCanonical;
    return localDb.getDmMessages(roomId);
  },

  async saveDmMessage(roomId, message, senderId, receiverId) {
    let canonicalRoomId = roomId;
    if (senderId && receiverId) {
      canonicalRoomId = getDmRoomId(senderId, receiverId);
    }

    if (isSupabaseConfigured) {
      try {
        const dbRow = {
          id: message.id,
          room_id: canonicalRoomId,
          sender_id: senderId,
          receiver_id: receiverId,
          sender_name: message.user || 'Kullanıcı',
          sender_avatar: message.avatar || '',
          color: message.color || '#90ba3c',
          has_crown: message.hasCrown || false,
          lines: message.lines || (message.text ? [message.text] : []),
          attachments: message.attachments || [],
          parent_id: message.parent_id || message.parentId || null,
          reply_to: message.reply_to ? (typeof message.reply_to === 'string' ? message.reply_to : JSON.stringify(message.reply_to)) : null,
          reactions: message.reactions ? (typeof message.reactions === 'string' ? message.reactions : JSON.stringify(message.reactions)) : '[]',
          timestamp_text: message.timestamp,
          sent_at: message.sentAt || Date.now(),
        };
        await supabase.from('direct_messages').insert([dbRow]);
      } catch (err) {
        console.warn('Supabase saveDmMessage error:', err);
      }
    }
    return localDb.addDmMessage(canonicalRoomId, message);
  },

  // Delete all messages in a DM room or channel
  async deleteChatMessages(roomId, channelId) {
    if (isSupabaseConfigured) {
      try {
        if (roomId) {
          await supabase.from('direct_messages').delete().eq('room_id', roomId);
          if (typeof roomId === 'string' && roomId.startsWith('dm-')) {
            const parts = roomId.replace(/^dm-/, '').split('--');
            if (parts.length === 2) {
              const alt = `dm-${parts[1]}--${parts[0]}`;
              await supabase.from('direct_messages').delete().eq('room_id', alt);
            }
          }
        }
        if (channelId) {
          await supabase.from('channel_messages').delete().eq('channel_id', channelId);
          await supabase.from('messages').delete().eq('channel_id', channelId);
        }
      } catch (err) {
        console.warn('Supabase deleteChatMessages error:', err);
      }
    }
    if (roomId) {
      localDb.deleteDmMessages(roomId);
    }
    if (channelId) {
      localDb.deleteChannelMessages(channelId);
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

        // Attempt upload to 'avatars' bucket with 3.5s timeout
        const uploadPromise = supabase.storage
          .from('avatars')
          .upload(filePath, processedFile, {
            cacheControl: '3600',
            upsert: true,
            contentType: processedFile.type || 'image/webp',
          });

        const { data, error: uploadError } = await withTimeout(
          uploadPromise,
          3500,
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

  // Download file helper (forces browser download with correct file name)
  async downloadFile(url, fileName = 'download') {
    if (!url) return;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      window.open(url, '_blank');
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

    const rawTag = (
      user.user_metadata?.tag ||
      metadata.tag ||
      String(Math.floor(1000 + Math.random() * 9000))
    ).toString().replace(/[^0-9]/g, '').slice(0, 4) || '0001';

    const avatarUrl = user.user_metadata?.avatar_url || metadata.avatar_url || metadata.avatar || '';

    let profileObj = {
      id: user.id,
      username: rawUsername,
      tag: rawTag,
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
            tag: existing.tag || rawTag,
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
          if (!existing.tag && rawTag) updateFields.tag = rawTag;
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
            tag: rawTag,
            avatar_url: avatarUrl,
            status: 'online',
            substatus: 'Çevrimiçi',
            updated_at: new Date().toISOString(),
          };

          let { data: inserted, error: insertErr } = await supabase
            .from('profiles')
            .upsert(insertPayload)
            .select()
            .maybeSingle();

          if (insertErr && insertErr.message && insertErr.message.includes('tag')) {
            delete insertPayload.tag;
            const res = await supabase.from('profiles').upsert(insertPayload).select().maybeSingle();
            inserted = res.data;
          }

          if (inserted) {
            profileObj = {
              id: inserted.id,
              username: inserted.username || rawUsername,
              tag: inserted.tag || rawTag,
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
    if (profileData.tag !== undefined) {
      updatePayload.tag = (profileData.tag || '').toString().replace(/[^0-9]/g, '').slice(0, 4) || '0001';
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
        let { data, error } = await withTimeout(
          supabase
            .from('profiles')
            .update(updatePayload)
            .eq('id', userId)
            .select()
            .maybeSingle(),
          8000,
          'Profil güncelleme zaman aşımına uğradı.'
        );

        // If tag column is not available in Supabase, retry without tag
        if (error && error.message && error.message.includes('tag')) {
          const fallbackPayload = { ...updatePayload };
          delete fallbackPayload.tag;
          const retryRes = await withTimeout(
            supabase
              .from('profiles')
              .update(fallbackPayload)
              .eq('id', userId)
              .select()
              .maybeSingle(),
            8000
          );
          data = retryRes.data;
          error = retryRes.error;
        }

        if (!error && data) {
          returnedProfile = {
            id: data.id,
            name: data.display_name || data.username,
            username: data.username,
            tag: data.tag || updatePayload.tag || '0001',
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
      tag: updatePayload.tag,
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
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        if (!error && data) {
          return {
            id: data.id,
            name: data.display_name || data.username,
            username: data.username,
            tag: data.tag || '0001',
            avatar: data.avatar_url,
            game: data.game,
            substatus: data.substatus,
            status: data.status,
            email: data.email,
          };
        }
      } catch (err) {
        console.warn('fetchUserProfile error:', err);
      }
    }
    const localUsers = localDb.getUsers();
    const u = localUsers.find((x) => x.id === userId);
    return u ? {
      id: u.id,
      name: u.display_name || u.username,
      username: u.username,
      avatar: u.avatar_url,
      game: u.game,
      substatus: u.substatus,
      status: u.status,
      email: u.email,
    } : null;
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

    let namePart = rawQuery;
    let tagPart = null;

    if (rawQuery.includes('#')) {
      const parts = rawQuery.split('#');
      namePart = parts[0].trim();
      tagPart = parts[1].trim();
    }

    const cleanName = namePart.toLowerCase();
    const cleanTag = tagPart ? tagPart.toLowerCase() : null;
    const foundMap = new Map();

    // 1. Search in Supabase profiles if configured
    if (isSupabaseConfigured) {
      try {
        let filterStr = '';
        if (cleanTag && cleanName) {
          filterStr = `and(username.ilike.%${cleanName}%,tag.eq.${cleanTag}),and(display_name.ilike.%${cleanName}%,tag.eq.${cleanTag})`;
        } else if (cleanTag && !cleanName) {
          filterStr = `tag.eq.${cleanTag}`;
        } else {
          filterStr = `username.ilike.%${cleanName}%,display_name.ilike.%${cleanName}%`;
        }

        let { data, error } = await supabase
          .from('profiles')
          .select('id, username, tag, display_name, avatar_url, status, substatus')
          .or(filterStr)
          .limit(15);

        // Fallback: If user searched name#tag but no exact tag match was found, search by name only
        if ((!data || data.length === 0) && cleanTag && cleanName) {
          try {
            const fallbackRes = await supabase
              .from('profiles')
              .select('id, username, tag, display_name, avatar_url, status, substatus')
              .or(`username.ilike.%${cleanName}%,display_name.ilike.%${cleanName}%`)
              .limit(15);
            if (!fallbackRes.error && Array.isArray(fallbackRes.data)) {
              data = fallbackRes.data;
            }
          } catch {}
        }

        // Fallback: If tag column does not exist in Supabase profiles yet
        if (error && error.message && error.message.includes('tag')) {
          const fallbackFilter = `username.ilike.%${cleanName}%,display_name.ilike.%${cleanName}%`;
          const res = await supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url, status, substatus')
            .or(fallbackFilter)
            .limit(15);
          data = res.data;
          error = res.error;
        }

        if (!error && Array.isArray(data)) {
          data.forEach((u) => {
            if (u.id !== currentUserId) {
              foundMap.set(u.id, {
                id: u.id,
                name: u.display_name || u.username,
                username: u.username,
                tag: u.tag || '0001',
                avatar: u.avatar_url,
                status: u.status || 'offline',
              });
            }
          });
        }
      } catch (err) {
        console.warn('Supabase searchUsers error:', err);
      }
    }

    // 2. Also search local database (covers offline mode, other test accounts, rate-limited users)
    const localUsers = localDb.getUsers();
    localUsers.forEach((u) => {
      if (u.id !== currentUserId && !foundMap.has(u.id)) {
        const uName = (u.username || '').toLowerCase();
        const uDisp = (u.display_name || '').toLowerCase();
        const uTag = (u.tag || '0001').toLowerCase();

        let matches = false;
        if (cleanTag && cleanName) {
          matches = (uName.includes(cleanName) || uDisp.includes(cleanName)) && (uTag === cleanTag || !tagPart);
          if (!matches) {
            matches = uName.includes(cleanName) || uDisp.includes(cleanName);
          }
        } else if (cleanTag && !cleanName) {
          matches = uTag === cleanTag;
        } else {
          matches = uName.includes(cleanName) || uDisp.includes(cleanName) || uTag.includes(cleanName);
        }

        if (matches) {
          foundMap.set(u.id, {
            id: u.id,
            name: u.display_name || u.username,
            username: u.username,
            tag: u.tag || '0001',
            avatar: u.avatar_url,
            status: u.status || 'offline',
          });
        }
      }
    });

    return Array.from(foundMap.values());
  },

  // Friendship Operations
  async sendFriendRequest(currentUserId, targetQueryOrId) {
    if (!currentUserId || !targetQueryOrId) {
      throw new Error('Eksik kullanıcı bilgisi.');
    }

    let targetUserId = targetQueryOrId;

    if (!targetQueryOrId.includes('-') || targetQueryOrId.includes('@') || targetQueryOrId.includes('#')) {
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
        const { data: existing, error: existErr } = await supabase
          .from('friendships')
          .select('*')
          .or(`and(user_id.eq.${currentUserId},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${currentUserId})`);

        if (existErr) {
          friendshipsTableAvailable = false;
        } else if (existing && existing.length > 0) {
          const f = existing[0];
          if (f.status === 'accepted') throw new Error('Bu kullanıcı ile zaten arkadaşsınız.');
          if (f.status === 'pending') throw new Error('Bekleyen bir arkadaşlık isteği zaten mevcut.');
        }

        if (friendshipsTableAvailable) {
          const { data, error } = await supabase
            .from('friendships')
            .insert([
              {
                user_id: currentUserId,
                friend_id: targetUserId,
                status: 'pending',
              },
            ])
            .select()
            .single();

          if (error) throw error;
          return data;
        }
      } catch (err) {
        if (err.message && (err.message.includes('zaten') || err.message.includes('Kendinize') || err.message.includes('bulunamadı'))) throw err;
        friendshipsTableAvailable = false;
      }

      // Realtime Bridge via direct_messages if friendships table is not yet created in Supabase
      if (!friendshipsTableAvailable) {
        try {
          const { data: existingDm } = await supabase
            .from('direct_messages')
            .select('*')
            .eq('room_id', 'dm-friendship-requests')
            .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${currentUserId})`);

          if (existingDm && existingDm.length > 0) {
            const last = existingDm[0];
            const statusLine = (last.lines && last.lines[0]) || '';
            if (statusLine.includes('accepted')) throw new Error('Bu kullanıcı ile zaten arkadaşsınız.');
            if (statusLine.includes('pending')) throw new Error('Bekleyen bir arkadaşlık isteği zaten mevcut.');
          }

          const reqId = `fr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const { data: dmData, error: dmErr } = await supabase
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
            .single();

          if (!dmErr && dmData) {
            return {
              id: dmData.id,
              user_id: currentUserId,
              friend_id: targetUserId,
              status: 'pending',
            };
          }
        } catch (dmErr) {
          if (dmErr.message && (dmErr.message.includes('zaten') || dmErr.message.includes('Kendinize') || dmErr.message.includes('bulunamadı'))) throw dmErr;
          console.warn('DM friendship bridge error:', dmErr);
        }
      }
    }

    // Local fallback
    const list = localDb.getFriendships();
    const existing = list.find((f) => 
      (f.user_id === currentUserId && f.friend_id === targetUserId) ||
      (f.user_id === targetUserId && f.friend_id === currentUserId)
    );
    if (existing) {
      if (existing.status === 'accepted') throw new Error('Bu kullanıcı ile zaten arkadaşsınız.');
      throw new Error('Bekleyen bir arkadaşlık isteği zaten mevcut.');
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
    if (!currentUserId) {
      return { friends: [], incoming: [], outgoing: [] };
    }

    if (isSupabaseConfigured) {
      let rows = null;

      // 1. Try friendships table
      try {
        const { data, error } = await supabase
          .from('friendships')
          .select('*')
          .or(`user_id.eq.${currentUserId},friend_id.eq.${currentUserId}`);
        if (!error && Array.isArray(data)) {
          rows = data;
        }
      } catch (err) {
        console.warn('Supabase fetchFriendships error:', err);
      }

      // 2. Fallback to direct_messages bridge if friendships table is not present
      if (!rows) {
        try {
          const { data: dmRows, error: dmErr } = await supabase
            .from('direct_messages')
            .select('*')
            .eq('room_id', 'dm-friendship-requests')
            .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);

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
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, username, tag, display_name, avatar_url, game, substatus, status')
            .in('id', otherIds);

          if (profiles) {
            profileMap = new Map(profiles.map((p) => [p.id, p]));
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
          const prof = profileMap.get(otherId) || {
            id: otherId,
            username: 'user',
            tag: '0001',
            display_name: 'Kullanıcı',
            status: 'offline',
          };

          const resolvedAvatar = prof.avatar_url || prof.avatar || null;

          const friendItem = {
            friendshipId: r.id,
            id: otherId,
            name: prof.display_name || prof.username || 'Kullanıcı',
            username: prof.username,
            tag: prof.tag || '0001',
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
        tag: u.tag || '0001',
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
    if (isSupabaseConfigured) {
      if (typeof friendshipId === 'string' && friendshipId.startsWith('fr-')) {
        try {
          await supabase
            .from('direct_messages')
            .update({ lines: ['__FRIEND_REQUEST:accepted__'] })
            .eq('id', friendshipId);
          return { id: friendshipId, status: 'accepted' };
        } catch (e) {
          console.warn('acceptFriendRequest DM bridge error:', e);
        }
      } else {
        try {
          const { data, error } = await supabase
            .from('friendships')
            .update({ status: 'accepted', updated_at: new Date().toISOString() })
            .eq('id', friendshipId)
            .select()
            .single();
          if (!error && data) return data;
        } catch (err) {
          console.warn('Supabase acceptFriendRequest error:', err);
        }
      }
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
    if (isSupabaseConfigured) {
      if (typeof friendshipId === 'string' && friendshipId.startsWith('fr-')) {
        try {
          await supabase
            .from('direct_messages')
            .delete()
            .eq('id', friendshipId);
          return true;
        } catch (e) {
          console.warn('rejectFriendRequest DM bridge error:', e);
        }
      } else {
        try {
          await supabase
            .from('friendships')
            .delete()
            .eq('id', friendshipId);
          return true;
        } catch (err) {
          console.warn('Supabase rejectFriendRequest error:', err);
        }
      }
    }
    const list = localDb.getFriendships().filter((f) => f.id !== friendshipId);
    localDb.saveFriendships(list);
    return true;
  },

  // Realtime Subscriptions with single persistent channel per table
  subscribeToTable(table, callback) {
    if (isSupabaseConfigured) {
      if (!sharedTableListeners.has(table)) {
        sharedTableListeners.set(table, new Set());
      }
      sharedTableListeners.get(table).add(callback);

      if (!sharedSupabaseChannels.has(table)) {
        const channel = supabase
          .channel(`shared_tbl_${table}`)
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
            if (err) console.warn(`[Realtime ${table}] subscription warning:`, err);
          });

        sharedSupabaseChannels.set(table, channel);
      }

      return () => {
        const listeners = sharedTableListeners.get(table);
        if (listeners) {
          listeners.delete(callback);
        }
      };
    }
    return localDb.subscribe(table, callback);
  },

  subscribeToChannelMessages(channelId, callback) {
    if (isSupabaseConfigured) {
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
        .subscribe();

      return () => {
        try {
          supabase.removeChannel(channel);
        } catch {}
      };
    }
    return localDb.subscribe('channel_messages', (payload) => {
      if (payload.channelId === channelId || !payload.channelId) {
        callback(payload);
      }
    });
  },

  subscribeToDmMessages(roomId, callback) {
    if (isSupabaseConfigured) {
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
        .subscribe();

      return () => {
        try {
          supabase.removeChannel(channel);
        } catch {}
      };
    }
    return localDb.subscribe('direct_messages', (payload) => {
      if (payload.roomId === roomId || !payload.roomId) {
        callback(payload);
      }
    });
  },
};

export default supabase;
