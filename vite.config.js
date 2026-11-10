import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { Server } from 'socket.io';

// Custom Vite plugin to embed Socket.IO server into the dev server with Realtime Presence
function socketServerPlugin() {
  return {
    name: 'socket-server-plugin',
    configureServer(server) {
      if (!server.httpServer) return;
      
      const io = new Server(server.httpServer, {
        cors: {
          origin: '*',
          methods: ['GET', 'POST'],
        },
      });

      const defaultRoom = 'standupp-room';

      // Server-side active user presences store (populated exclusively by real connected users)
      const activePresences = new Map();

      io.on('connection', (socket) => {
        socket.join(defaultRoom);

        // Send all current presences to newly connected client
        socket.emit('presence_sync', Array.from(activePresences.values()));

        socket.on('join_room', (room) => {
          if (room) {
            socket.join(room);
          }
        });

        socket.on('leave_room', (room) => {
          if (room) {
            socket.leave(room);
          }
        });

        // Chat message broadcasting
        socket.on('send_message', (message) => {
          io.to(message.room || defaultRoom).emit('receive_message', message);
        });

        // Message read receipt broadcasting
        socket.on('message_read', (data) => {
          if (data?.room) {
            io.to(data.room).emit('message_read', data);
          }
          io.emit('message_read', data);
        });

        // Emoji reaction broadcasting
        socket.on('send_reaction', (data) => {
          io.to(data.room || defaultRoom).emit('receive_reaction', data);
        });

        // Typing indicator
        socket.on('typing', (data) => {
          socket.to(data.room || defaultRoom).emit('user_typing', data);
        });

        // Real-time Presence & Rich Presence Activity update
        socket.on('update_presence', (presenceData) => {
          if (!presenceData) return;
          const key = presenceData.userId || presenceData.id || socket.id;
          const merged = {
            ...activePresences.get(key),
            ...presenceData,
            socketId: socket.id,
            lastUpdated: Date.now(),
          };
          activePresences.set(key, merged);
          // Broadcast to everyone
          io.emit('presence_updated', merged);
        });

        // Real-time In-Chat Voice Call Status broadcasting
        socket.on('call_update', (callData) => {
          io.emit('call_status_updated', callData);
        });

        socket.on('get_presences', () => {
          socket.emit('presence_sync', Array.from(activePresences.values()));
        });

        socket.on('disconnect', () => {
          // Keep persistent presences, but if user was tied only to this socket and not permanent, can be updated
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), socketServerPlugin()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: process.env.TAURI_DEV_HOST || false,
    watch: {
      ignored: ['**/src-tauri/**', '**/target/**'],
    },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
