import { io } from 'socket.io-client';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

class RealtimeChatService {
  constructor() {
    this.socket = null;
    this.broadcastChannel = null;
    this.presenceBroadcastChannel = null;
    this.supabaseCallChannel = null;
    this.supabasePresenceChannel = null;
    this.currentPresencePayload = null;
    this.activeVoiceChannelId = null;
    this.room = 'home';
    this.listeners = {
      message: [],
      reaction: [],
      typing: [],
      connected: [],
      presence: [],
      all_presences: [],
      call_status: [],
      account_deleted: [],
    };
  }

  on(event, cb) {
    if (this.listeners[event]) {
      this.listeners[event].push(cb);
    }
  }

  off(event, cb) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(fn => fn !== cb);
    }
  }

  emitLocal(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(fn => fn(data));
    }
  }

  init(initialRoom = 'home') {
    this.room = initialRoom;
    this.setupBroadcastChannel(initialRoom);
    this.setupPresenceBroadcastChannel();

    if (!this.socket && typeof window !== 'undefined') {
      try {
        const socketUrl = window.location.origin;
        this.socket = io(socketUrl, {
          transports: ['websocket', 'polling'],
          reconnectionAttempts: 5,
          timeout: 5000,
        });

        this.socket.on('connect', () => {
          this.emitLocal('connected', true);
          this.socket.emit('join_room', this.room);
          this.socket.emit('get_presences');
        });

        this.socket.on('receive_message', (msg) => {
          if (msg.room === this.room) {
            this.emitLocal('message', msg);
          }
        });

        this.socket.on('receive_reaction', (data) => {
          if (data.room === this.room) {
            this.emitLocal('reaction', data);
          }
        });

        this.socket.on('user_typing', (data) => {
          if (data.room === this.room) {
            this.emitLocal('typing', data);
          }
        });

        // Realtime Presence listeners
        this.socket.on('presence_updated', (data) => {
          this.emitLocal('presence', data);
        });

        this.socket.on('presence_sync', (list) => {
          this.emitLocal('all_presences', list);
        });

        // Realtime In-Chat Voice Call Status listener
        this.socket.on('call_status_updated', (data) => {
          this.emitLocal('call_status', data);
        });

        // Realtime message read receipt listener
        this.socket.on('message_read', (data) => {
          this.emitLocal('message_read', data);
        });

        this.socket.on('disconnect', () => {
          this.emitLocal('connected', false);
        });
      } catch (err) {
        console.warn('Socket.IO initialization error:', err);
      }
    }
  }

  setupBroadcastChannel(room) {
    if (typeof window === 'undefined' || !window.BroadcastChannel) return;

    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }

    try {
      this.broadcastChannel = new BroadcastChannel(`standupp_chat_${room}`);
      this.broadcastChannel.onmessage = (event) => {
        if (event.data?.type === 'CHAT_MESSAGE' && event.data.payload?.room === this.room) {
          this.emitLocal('message', event.data.payload);
        } else if (event.data?.type === 'MESSAGE_REACTION' && event.data.payload?.room === this.room) {
          this.emitLocal('reaction', event.data.payload);
        } else if (event.data?.type === 'USER_TYPING' && event.data.payload?.room === this.room) {
          this.emitLocal('typing', event.data.payload);
        }
      };
    } catch (err) {
      console.warn('BroadcastChannel error:', err);
    }
  }

  setupPresenceBroadcastChannel() {
    if (typeof window === 'undefined' || !window.BroadcastChannel) return;

    if (!this.presenceBroadcastChannel) {
      try {
        this.presenceBroadcastChannel = new BroadcastChannel('standupp_global_presence');
        this.presenceBroadcastChannel.onmessage = (event) => {
          if (event.data?.type === 'PRESENCE_UPDATE' && event.data.payload) {
            this.emitLocal('presence', event.data.payload);
          } else if (event.data?.type === 'PRESENCE_LEAVE' && event.data.payload) {
            this.emitLocal('presence', {
              ...event.data.payload,
              status: 'offline',
              isOnline: false,
            });
          } else if (event.data?.type === 'PRESENCE_REQUEST') {
            // Another tab requested presences - respond with our active presence if we are active
            if (this.currentPresencePayload && this.currentPresencePayload.isOnline) {
              this.presenceBroadcastChannel.postMessage({
                type: 'PRESENCE_UPDATE',
                payload: this.currentPresencePayload,
              });
            }
          } else if (event.data?.type === 'CALL_STATUS_UPDATE' && event.data.payload) {
            this.emitLocal('call_status', event.data.payload);
          } else if (event.data?.type === 'MESSAGE_READ' && event.data.payload) {
            this.emitLocal('message_read', event.data.payload);
          } else if (event.data?.type === 'ACCOUNT_DELETED' && event.data.payload) {
            this.emitLocal('account_deleted', event.data.payload);
          }
        };

        // When window/tab closes, broadcast leave to other tabs
        window.addEventListener('beforeunload', () => {
          this.leavePresence();
        });
      } catch (err) {
        console.warn('Presence BroadcastChannel error:', err);
      }
    }

    if (isSupabaseConfigured && !this.supabasePresenceChannel) {
      try {
        this.supabasePresenceChannel = supabase.channel('standupp_global_presence_v2')
          .on('presence', { event: 'sync' }, () => {
            const state = this.supabasePresenceChannel.presenceState();
            const list = [];
            Object.values(state).forEach((items) => {
              if (Array.isArray(items)) {
                items.forEach((item) => list.push(item));
              }
            });
            this.emitLocal('all_presences', list);
          })
          .on('presence', { event: 'join' }, ({ newPresences }) => {
            if (Array.isArray(newPresences)) {
              newPresences.forEach((p) => this.emitLocal('presence', p));
            }
          })
          .on('presence', { event: 'leave' }, ({ currentPresences, leftPresences }) => {
            if (Array.isArray(currentPresences) && currentPresences.length > 0) {
              const newest = currentPresences[currentPresences.length - 1];
              if (newest) {
                this.emitLocal('presence', newest);
                return;
              }
            }
            if (Array.isArray(leftPresences)) {
              const state = this.supabasePresenceChannel?.presenceState?.() || {};
              const activeUserIds = new Set();
              Object.values(state).forEach((items) => {
                if (Array.isArray(items)) {
                  items.forEach((item) => {
                    const id = item?.userId || item?.id;
                    if (id) activeUserIds.add(String(id));
                  });
                }
              });

              leftPresences.forEach((p) => {
                const uid = p?.userId || p?.id;
                if (uid && activeUserIds.has(String(uid))) return;
                this.emitLocal('presence', {
                  ...p,
                  status: 'offline',
                  isOnline: false,
                  voiceChannelId: null,
                });
              });
            }
          })
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED' && this.currentPresencePayload && this.currentPresencePayload.isOnline) {
              await this.supabasePresenceChannel.track(this.currentPresencePayload).catch(() => {});
            }
          });
      } catch (err) {
        console.warn('Supabase presence channel error:', err);
      }
    }

    if (isSupabaseConfigured && !this.supabaseCallChannel) {
      try {
        this.supabaseCallChannel = supabase.channel('standupp_global_calls')
          .on('broadcast', { event: 'call_update' }, ({ payload }) => {
            if (payload) {
              this.emitLocal('call_status', payload);
            }
          })
          .on('broadcast', { event: 'account_deleted' }, ({ payload }) => {
            if (payload?.userId) {
              this.emitLocal('account_deleted', payload);
            }
          })
          .subscribe();
      } catch (err) {
        console.warn('Supabase call channel error:', err);
      }
    }
  }

  setRoom(newRoom) {
    if (!newRoom || this.room === newRoom) return;
    const oldRoom = this.room;
    this.room = newRoom;

    if (this.socket && this.socket.connected) {
      this.socket.emit('leave_room', oldRoom);
      this.socket.emit('join_room', newRoom);
    }

    this.setupBroadcastChannel(newRoom);
  }

  sendMessage(messagePayload) {
    const formattedMsg = {
      ...messagePayload,
      room: this.room,
      sentAt: Date.now(),
    };

    // 1. Emit via Socket.IO
    if (this.socket && this.socket.connected) {
      this.socket.emit('send_message', formattedMsg);
    }

    // 2. Emit via BroadcastChannel
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'CHAT_MESSAGE',
        payload: formattedMsg,
      });
    }

    // 3. Emit locally
    this.emitLocal('message', formattedMsg);
  }

  sendReaction(reactionData) {
    const payload = {
      ...reactionData,
      room: this.room,
      timestamp: Date.now(),
    };

    // 1. Emit via Socket.IO
    if (this.socket && this.socket.connected) {
      this.socket.emit('send_reaction', payload);
    }

    // 2. Emit via BroadcastChannel
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'MESSAGE_REACTION',
        payload,
      });
    }

    // 3. Emit locally
    this.emitLocal('reaction', payload);
  }

  sendTyping(user, isTyping = true) {
    const data = { user, isTyping, room: this.room };
    if (this.socket && this.socket.connected) {
      this.socket.emit('typing', data);
    }
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'USER_TYPING',
        payload: data,
      });
    }
  }

  // Track active voice channel on global presence so non-joined group members see live participants
  setVoiceChannel(channelId, fallbackProfile = null) {
    const normalized = channelId ? String(channelId) : null;
    this.activeVoiceChannelId = normalized;

    const basePayload = this.currentPresencePayload || fallbackProfile;
    if (basePayload) {
      this.updatePresence({
        ...basePayload,
        voiceChannelId: normalized,
      });
    }
  }

  // Update real-time presence & rich presence activity
  updatePresence(presenceData) {
    if (!presenceData) return;

    const userId = presenceData.id || presenceData.userId;
    if (!userId || userId === 'you') return;

    const isOnline = presenceData.status !== 'offline' && presenceData.status !== 'invisible';
    const voiceChannelId =
      presenceData.voiceChannelId !== undefined
        ? (presenceData.voiceChannelId ? String(presenceData.voiceChannelId) : null)
        : (this.activeVoiceChannelId || null);

    const payload = {
      userId,
      id: userId,
      name: presenceData.name || presenceData.display_name || '',
      avatar: presenceData.avatar || presenceData.avatar_url || '',
      status: presenceData.status || 'online',
      game: presenceData.game || '',
      substatus: presenceData.substatus || '',
      isAway: presenceData.status === 'idle' || !!presenceData.isAway,
      isOnline,
      voiceChannelId: isOnline ? voiceChannelId : null,
      timestamp: Date.now(),
    };

    this.currentPresencePayload = payload;

    if (this.socket && this.socket.connected) {
      this.socket.emit('update_presence', payload);
    }

    if (this.presenceBroadcastChannel) {
      this.presenceBroadcastChannel.postMessage({
        type: isOnline ? 'PRESENCE_UPDATE' : 'PRESENCE_LEAVE',
        payload,
      });
    }

    if (this.supabasePresenceChannel) {
      if (isOnline) {
        this.supabasePresenceChannel.track(payload).catch(() => {});
      } else {
        this.supabasePresenceChannel.untrack().catch(() => {});
      }
    }

    this.emitLocal('presence', payload);
  }

  // Gracefully leave / set presence offline
  leavePresence() {
    this.activeVoiceChannelId = null;
    if (!this.currentPresencePayload) return;
    const payload = {
      ...this.currentPresencePayload,
      status: 'offline',
      isOnline: false,
      voiceChannelId: null,
      timestamp: Date.now(),
    };

    if (this.presenceBroadcastChannel) {
      this.presenceBroadcastChannel.postMessage({
        type: 'PRESENCE_LEAVE',
        payload,
      });
    }

    if (this.supabasePresenceChannel) {
      try {
        this.supabasePresenceChannel.untrack().catch(() => {});
      } catch {}
    }

    this.emitLocal('presence', payload);
    this.currentPresencePayload = null;
  }

  // Request all presences from server/network
  requestPresences() {
    if (this.socket && this.socket.connected) {
      this.socket.emit('get_presences');
    }
    if (this.presenceBroadcastChannel) {
      this.presenceBroadcastChannel.postMessage({
        type: 'PRESENCE_REQUEST',
        senderId: this.currentPresencePayload?.userId || null,
      });
    }
    if (this.supabasePresenceChannel) {
      try {
        const state = this.supabasePresenceChannel.presenceState?.();
        if (state && typeof state === 'object') {
          const list = [];
          Object.values(state).forEach((items) => {
            if (Array.isArray(items)) {
              items.forEach((item) => list.push(item));
            }
          });
          if (list.length > 0) {
            this.emitLocal('all_presences', list);
          }
        }
      } catch {}
    }
  }

  // Realtime in-chat voice call broadcast
  sendCallUpdate(callData) {
    if (!callData) return;

    if (this.socket && this.socket.connected) {
      this.socket.emit('call_update', callData);
    }

    if (this.presenceBroadcastChannel) {
      this.presenceBroadcastChannel.postMessage({
        type: 'CALL_STATUS_UPDATE',
        payload: callData,
      });
    }

    if (isSupabaseConfigured && this.supabaseCallChannel) {
      try {
        this.supabaseCallChannel.send({
          type: 'broadcast',
          event: 'call_update',
          payload: callData,
        });
      } catch (err) {
        console.warn('Supabase call broadcast send error:', err);
      }
    }

    this.emitLocal('call_status', callData);
  }

  // Broadcast account deletion event to connected clients and browser tabs
  broadcastAccountDeleted(userId) {
    if (!userId) return;
    const payload = {
      userId: String(userId),
      deletedAt: new Date().toISOString(),
    };

    if (this.presenceBroadcastChannel) {
      try {
        this.presenceBroadcastChannel.postMessage({
          type: 'ACCOUNT_DELETED',
          payload,
        });
      } catch { }
    }

    if (isSupabaseConfigured && this.supabaseCallChannel) {
      try {
        this.supabaseCallChannel.send({
          type: 'broadcast',
          event: 'account_deleted',
          payload,
        });
      } catch (err) {
        console.warn('Supabase account_deleted broadcast send error:', err);
      }
    }

    this.emitLocal('account_deleted', payload);
  }

  // Emit read receipt for a room
  sendReadReceipt(roomId, readerId) {
    if (!roomId) return;
    const payload = { room: roomId, roomId, readerId, readAt: Date.now() };

    if (this.socket && this.socket.connected) {
      this.socket.emit('message_read', payload);
    }

    if (this.presenceBroadcastChannel) {
      this.presenceBroadcastChannel.postMessage({
        type: 'MESSAGE_READ',
        payload,
      });
    }

    this.emitLocal('message_read', payload);
  }

  disconnect() {
    this.activeVoiceChannelId = null;
    this.leavePresence();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
    if (this.presenceBroadcastChannel) {
      this.presenceBroadcastChannel.close();
      this.presenceBroadcastChannel = null;
    }
    if (this.supabaseCallChannel) {
      try {
        supabase.removeChannel(this.supabaseCallChannel);
      } catch {}
      this.supabaseCallChannel = null;
    }
  }
}

export const chatService = new RealtimeChatService();
