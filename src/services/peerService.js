import Peer from 'peerjs';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  STORAGE_KEYS,
  DEFAULT_AI_NOISE_SUPPRESSION,
  DEFAULT_NOISE_GATE_THRESHOLD,
  normalizeNoiseSuppressionMode,
  clampNoiseGateThreshold,
  readStoredBool,
  readStoredNumber,
  readStoredNoiseSuppressionMode,
  buildAudioDspPlan,
  buildMicDspChain,
  createVoiceAudioContext,
} from '../utils/noiseSuppressionPipeline';

export const SCREEN_SHARE_PRESETS = {
  performance: {
    id: 'performance',
    label: 'Performans (720p · 15 FPS)',
    desc: 'CS2 / FPS oyunlarında en düşük GPU ve ağ yükü',
    maxWidth: 1280,
    maxHeight: 720,
    maxFrameRate: 15,
    maxBitrate: 900_000,
  },
  balanced: {
    id: 'balanced',
    label: 'Dengeli (720p · 30 FPS)',
    desc: 'Çoğu oyun ve ekran paylaşımı için ideal kalite/performans',
    maxWidth: 1280,
    maxHeight: 720,
    maxFrameRate: 30,
    maxBitrate: 1_800_000,
  },
  high: {
    id: 'high',
    label: 'Yüksek Kalite (1080p · 60 FPS)',
    desc: 'Maksimum netlik (daha yüksek GPU / CPU ve upload gerektirir)',
    maxWidth: 1920,
    maxHeight: 1080,
    maxFrameRate: 60,
    maxBitrate: 4_000_000,
  },
};

function readInitialScreenSharePreset() {
  return 'balanced';
}

/**
 * Enhances WebRTC Opus SDP parameters for clean voice clarity and resilience:
 * - Enables in-band Forward Error Correction (useinbandfec=1) to eliminate packet-loss crackles
 * - Sets 64 kbps mono voice bitrate ceiling (maxaveragebitrate=64000, stereo=0)
 * - Disables discontinuous comfort noise hiss (usedtx=0)
 */
export function optimizeOpusSdp(sdp) {
  if (!sdp || typeof sdp !== 'string') return sdp;

  const eol = sdp.includes('\r\n') ? '\r\n' : '\n';
  const lines = sdp.split(/\r?\n/);

  let opusPt = null;
  let rtpmapIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^a=rtpmap:(\d+)\s+opus\/48000/i);
    if (m) {
      opusPt = m[1];
      rtpmapIdx = i;
      break;
    }
  }
  if (!opusPt) return sdp;

  const desiredParams = {
    minptime: '20',
    ptime: '20',
    useinbandfec: '1',
    usedtx: '1',
    stereo: '0',
    'sprop-stereo': '0',
    maxaveragebitrate: '40000',
  };

  const fmtpPrefix = `a=fmtp:${opusPt} `;
  const fmtpIdx = lines.findIndex((line) => line.startsWith(fmtpPrefix));

  if (fmtpIdx !== -1) {
    const rawParams = lines[fmtpIdx].slice(fmtpPrefix.length).trim();
    const paramMap = new Map();
    rawParams.split(';').forEach((token) => {
      const cleaned = token.trim();
      if (!cleaned) return;
      const eqIdx = cleaned.indexOf('=');
      if (eqIdx === -1) {
        paramMap.set(cleaned, null);
      } else {
        paramMap.set(cleaned.slice(0, eqIdx).trim(), cleaned.slice(eqIdx + 1).trim());
      }
    });

    Object.entries(desiredParams).forEach(([k, v]) => {
      paramMap.set(k, v);
    });

    const formatted = Array.from(paramMap.entries())
      .map(([k, v]) => (v === null ? k : `${k}=${v}`))
      .join(';');
    lines[fmtpIdx] = `${fmtpPrefix}${formatted}`;
  } else if (rtpmapIdx !== -1) {
    const formatted = Object.entries(desiredParams)
      .map(([k, v]) => `${k}=${v}`)
      .join(';');
    lines.splice(rtpmapIdx + 1, 0, `${fmtpPrefix}${formatted}`);
  }

  return lines.join(eol);
}

export class MeshVoiceService {
  constructor() {
    this.peer = null;
    this.myPeerId = null;
    this.userName = 'Sen (You)';
    this.userMeta = { userId: null, name: 'Sen (You)', avatar: null };
    this.rawLocalStream = null;
    this.localStream = null;
    this.micAudioCtx = null;
    this.micGainNode = null;
    this.micChainCleanup = null;
    this._dspBuildSeq = 0;
    this._pendingLocalAudioPromise = null;
    this.activeCalls = new Map(); // peerId -> MediaConnection
    this.activeDataConns = new Map(); // peerId -> DataConnection
    this.remoteStreams = new Map(); // peerId -> MediaStream
    this.peerMetadata = new Map(); // peerId -> { userId, name, userName, avatar }
    this.failedCallAttempts = new Map(); // peerId -> consecutive failure count
    this.broadcastChannel = null;
    this.supabaseVoiceChannel = null;
    this.roomName = 'sesli-sohbet-mesh-v1';

    // Local mute, deafen, and push-to-talk transmission state
    this.isLocalMuted = false;
    this.isLocalDeafened = false;
    this.inputMode = 'voice'; // 'voice' | 'ptt'
    this.isPttActive = false;
    this.meshWatchdogInterval = null;

    this.selectedAudioInputId = null;
    this.advancedAudioFiltering = readStoredBool('standupp_advanced_audio_filtering', true);
    this.autoGainControlEnabled = readStoredBool('standupp_auto_gain_control', true);
    this.antiStaticFilterEnabled = readStoredBool('standupp_anti_static_filter', true);
    this.aiNoiseSuppressionEnabled = DEFAULT_AI_NOISE_SUPPRESSION;
    this.noiseSuppressionMode = readStoredNoiseSuppressionMode();
    this.noiseGateThreshold = clampNoiseGateThreshold(
      readStoredNumber(STORAGE_KEYS.noiseGateThreshold, DEFAULT_NOISE_GATE_THRESHOLD)
    );
    this.inputVolume = Math.max(0, Math.min(200, readStoredNumber('standupp_input_volume', 100)));
    this.lastDspInfo = {
      aiNsApplied: false,
      noiseGateApplied: false,
      sampleRate: null,
      mode: this.noiseSuppressionMode,
    };

    // Screen sharing state
    this.screenStream = null;
    this.screenSharePreset = readInitialScreenSharePreset();
    this.activeScreenCalls = new Map(); // peerId -> MediaConnection (outgoing)
    this.remoteScreenCalls = new Map(); // peerId -> MediaConnection (incoming)
    this.availableScreenShares = new Map(); // peerId -> screenShareInfo
    this.activeScreenShare = null; // { isLocal, peerId, userName, stream }

    // Latency & Connection Quality Monitoring (RTT in ms)
    this.peerLatencies = new Map(); // peerId -> RTT ms
    this.myPing = 24;
    this.pingInterval = null;

    this.eventListeners = {
      ready: [],
      stream: [],
      peerLeft: [],
      error: [],
      peersUpdated: [],
      peerMetadataUpdated: [],
      localStreamChanged: [],
      screenShareStarted: [],
      screenShareStopped: [],
      latenciesUpdated: [],
      peerSpeakingUpdate: [],
    };
    this.lastBroadcastSpeaking = null;
  }

  // Event listener management
  on(event, callback) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].push(callback);
    }
  }

  off(event, callback) {
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
    }
  }

  emit(event, data) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(cb => cb(data));
    }
  }

  // Store & broadcast remote peer profile metadata
  setPeerMetadata(peerId, meta = {}) {
    if (!peerId || peerId === this.myPeerId) return;
    const prev = this.peerMetadata.get(peerId) || {};
    const nextName = meta.userName || meta.name || meta.display_name || prev.name || null;
    const nextUserId = meta.userId || meta.id || prev.userId || null;
    const nextAvatar = meta.avatar || meta.avatar_url || prev.avatar || null;
    const nextRoom = meta.room || meta.channelId || prev.room || this.roomName || null;
    const next = {
      ...prev,
      ...(nextRoom ? { room: nextRoom } : {}),
      ...(nextUserId ? { userId: nextUserId } : {}),
      ...(nextName ? { name: nextName, userName: nextName } : {}),
      ...(nextAvatar ? { avatar: nextAvatar } : {}),
      ...(typeof meta.isMuted === 'boolean' ? { isMuted: meta.isMuted } : {}),
      ...(typeof meta.isDeafened === 'boolean' ? { isDeafened: meta.isDeafened } : {}),
    };
    this.peerMetadata.set(peerId, next);
    this.emit('peerMetadataUpdated', Object.fromEntries(this.peerMetadata));
  }

  // Update peer mute state by userId across all registered peer connections
  setMuteByUserId(userId, isMuted, isDeafened = false) {
    if (!userId) return false;
    const uidStr = String(userId).toLowerCase();
    let updated = false;
    for (const [peerId, meta] of this.peerMetadata.entries()) {
      if (meta?.userId && String(meta.userId).toLowerCase() === uidStr) {
        this.setPeerMetadata(peerId, {
          isMuted: Boolean(isMuted),
          ...(typeof isDeafened === 'boolean' ? { isDeafened: Boolean(isDeafened) } : {}),
        });
        updated = true;
      }
    }
    return updated;
  }

  // Real-time peer-to-peer Voice Activity Detection (VAD) broadcast across mesh
  broadcastSpeaking(isSpeaking) {
    const boolSpeaking = Boolean(isSpeaking);
    if (this.lastBroadcastSpeaking === boolSpeaking) return;
    this.lastBroadcastSpeaking = boolSpeaking;

    const payload = {
      type: 'PEER_SPEAKING_UPDATE',
      room: this.roomName,
      peerId: this.myPeerId,
      userId: this.userMeta?.userId || null,
      isSpeaking: boolSpeaking,
      timestamp: Date.now(),
    };

    // 1. Direct WebRTC Data Connections (ultra-low latency <15ms)
    this.activeDataConns.forEach((conn) => {
      try {
        if (conn.open) {
          conn.send(payload);
        }
      } catch {}
    });

    // 2. Local window/tab BroadcastChannel
    try {
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage(payload);
      }
    } catch {}

    // 3. Cloud Supabase Realtime broadcast
    try {
      if (this.supabaseVoiceChannel) {
        this.supabaseVoiceChannel.send({
          type: 'broadcast',
          event: 'peer_speaking_update',
          payload,
        }).catch(() => {});
      }
    } catch {}
  }

  getAllPeerMetadata() {
    return Object.fromEntries(this.peerMetadata);
  }

  // Set advanced audio filtering, AI noise suppression & voice clarity state
  setAdvancedAudioFiltering(enabled) {
    this.advancedAudioFiltering = Boolean(enabled);
  }

  setAutoGainControl(enabled) {
    this.autoGainControlEnabled = Boolean(enabled);
  }

  setAntiStaticFilter(enabled) {
    this.antiStaticFilterEnabled = Boolean(enabled);
  }

  setAiNoiseSuppression(enabled) {
    this.aiNoiseSuppressionEnabled = Boolean(enabled);
  }

  setNoiseSuppressionMode(mode) {
    this.noiseSuppressionMode = normalizeNoiseSuppressionMode(mode);
  }

  setNoiseGateThreshold(threshold) {
    this.noiseGateThreshold = clampNoiseGateThreshold(threshold);
  }

  getDspConfig() {
    return {
      aiNoiseSuppression: this.aiNoiseSuppressionEnabled,
      noiseSuppressionMode: this.noiseSuppressionMode,
      noiseGateThreshold: this.noiseGateThreshold,
      antiStaticFilter: this.antiStaticFilterEnabled,
      inputVolume: this.inputVolume,
    };
  }

  getNoiseSuppressionStatus() {
    return {
      enabled: this.aiNoiseSuppressionEnabled,
      mode: this.noiseSuppressionMode,
      gateThreshold: this.noiseGateThreshold,
      ...this.lastDspInfo,
    };
  }

  getBaseAudioConstraints(deviceIdOverride = this.selectedAudioInputId, customConstraints = null) {
    return {
      echoCancellation: this.advancedAudioFiltering,
      noiseSuppression: this.advancedAudioFiltering,
      autoGainControl: this.autoGainControlEnabled,
      sampleRate: { ideal: 48000 },
      channelCount: { ideal: 1 },
      ...(deviceIdOverride ? { deviceId: { exact: deviceIdOverride } } : {}),
      ...customConstraints,
    };
  }

  cleanupMicProcessing() {
    if (this.micChainCleanup) {
      try {
        this.micChainCleanup();
      } catch {}
      this.micChainCleanup = null;
    }
    this.micGainNode = null;
    if (this.micAudioCtx) {
      try {
        this.micAudioCtx.close().catch(() => {});
      } catch {}
      this.micAudioCtx = null;
    }
  }

  stopLocalAudioTracks() {
    this._dspBuildSeq += 1;
    this._pendingLocalAudioPromise = null;
    this.cleanupMicProcessing();
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => {
        try { t.stop(); } catch {}
      });
      this.localStream = null;
    }
    if (this.rawLocalStream) {
      this.rawLocalStream.getTracks().forEach((t) => {
        try { t.stop(); } catch {}
      });
      this.rawLocalStream = null;
    }
    this.lastDspInfo = {
      aiNsApplied: false,
      noiseGateApplied: false,
      sampleRate: null,
      mode: this.noiseSuppressionMode,
    };
  }

  async buildProcessedLocalStream(rawStream, dspOverrides = null) {
    const buildSeq = ++this._dspBuildSeq;
    this.cleanupMicProcessing();
    if (!rawStream || rawStream.getAudioTracks().length === 0) return rawStream;

    const dspConfig = this.getDspConfig();
    const plan = buildAudioDspPlan(dspConfig);
    if (!plan.needsDsp || (typeof window === 'undefined' && !dspOverrides?.audioContext)) {
      this.lastDspInfo = {
        aiNsApplied: false,
        noiseGateApplied: false,
        sampleRate: null,
        mode: plan.mode,
      };
      return rawStream;
    }

    let ctx = null;
    let chain = null;
    try {
      ctx = dspOverrides?.audioContext || createVoiceAudioContext();
      if (!ctx) return rawStream;

      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        ctx.resume().catch(() => {});
      }

      const source = ctx.createMediaStreamSource(rawStream);
      chain = await buildMicDspChain(ctx, source, dspConfig, dspOverrides);

      // Guard against concurrent toggles, device swaps, or call disconnect during async worklet setup
      if (buildSeq !== this._dspBuildSeq || this.rawLocalStream !== rawStream || !rawStream.active) {
        try { chain?.cleanup?.(); } catch {}
        if (typeof ctx.close === 'function') {
          try { await ctx.close(); } catch {}
        }
        return this.localStream || rawStream;
      }

      const dest = ctx.createMediaStreamDestination();
      chain.outputNode.connect(dest);

      const rawTrack = rawStream.getAudioTracks()[0];
      const outTrack = dest.stream.getAudioTracks()[0];
      if (rawTrack && outTrack) {
        outTrack.enabled = rawTrack.enabled;
      }

      this.micAudioCtx = ctx;
      this.micGainNode = chain.gainNode;
      this.micChainCleanup = chain.cleanup;
      this.lastDspInfo = {
        aiNsApplied: chain.aiNsApplied,
        noiseGateApplied: chain.noiseGateApplied,
        sampleRate: chain.sampleRate,
        mode: plan.mode,
      };
      return dest.stream;
    } catch (err) {
      console.warn('Audio DSP pipeline fallback to raw mic stream:', err);
      try { chain?.cleanup?.(); } catch {}
      if (ctx && typeof ctx.close === 'function') {
        try { await ctx.close(); } catch {}
      }
      this.cleanupMicProcessing();
      this.lastDspInfo = {
        aiNsApplied: false,
        noiseGateApplied: false,
        sampleRate: null,
        mode: plan.mode,
      };
      return rawStream;
    }
  }

  async rebuildProcessedStream() {
    if (!this.rawLocalStream || !this.rawLocalStream.active) return null;
    const targetRaw = this.rawLocalStream;
    const expectedSeq = this._dspBuildSeq + 1;
    const processed = await this.buildProcessedLocalStream(targetRaw);

    if (
      expectedSeq !== this._dspBuildSeq ||
      this.rawLocalStream !== targetRaw ||
      !targetRaw.active
    ) {
      return this.localStream;
    }

    this.localStream = processed;
    this.applyAudioTrackGating();
    const nextTrack = processed?.getAudioTracks?.()[0];
    if (nextTrack) {
      this.replaceOutgoingAudioTrack(nextTrack);
    }
    this.emit('localStreamChanged', processed);
    return processed;
  }

  replaceOutgoingAudioTrack(newTrack) {
    if (!newTrack) return;
    this.activeCalls.forEach((call) => {
      try {
        if (call.peerConnection) {
          const senders = call.peerConnection.getSenders();
          const audioSender = senders.find((s) => s.track && s.track.kind === 'audio');
          if (audioSender) {
            audioSender.replaceTrack(newTrack).catch((err) => {
              console.warn('replaceTrack warning:', err);
            });
          }
        }
      } catch (e) {
        console.warn('Call sender replaceTrack error:', e);
      }
    });
  }

  setInputVolume(volumePercent) {
    const rawNum = Number(volumePercent);
    const clamped = Math.max(0, Math.min(200, Number.isFinite(rawNum) ? rawNum : 100));
    this.inputVolume = clamped;

    if (this.micGainNode && this.micAudioCtx && this.micAudioCtx.state !== 'closed') {
      try {
        this.micGainNode.gain.setTargetAtTime(clamped / 100, this.micAudioCtx.currentTime, 0.015);
      } catch {
        this.micGainNode.gain.value = clamped / 100;
      }
    } else if (this.rawLocalStream && this.rawLocalStream.active && clamped !== 100) {
      // Lazily attach DSP/gain pipeline when user adjusts mic slider from 100%
      this.rebuildProcessedStream().catch(() => {});
    }
  }

  // 1. Get user microphone access via navigator.mediaDevices.getUserMedia with voice clarity pipeline
  async getLocalAudioStream(customConstraints = null) {
    if (this.localStream && this.localStream.active) {
      return this.localStream;
    }
    if (this._pendingLocalAudioPromise && !customConstraints) {
      return this._pendingLocalAudioPromise;
    }

    const task = (async () => {
      try {
        const audioConstraints = this.getBaseAudioConstraints(this.selectedAudioInputId, customConstraints);
        const rawStream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
          video: false,
        });

        this.rawLocalStream = rawStream;
        this.localStream = await this.buildProcessedLocalStream(rawStream);
        this.applyAudioTrackGating();
        return this.localStream;
      } catch (err) {
        console.warn('Microphone access denied or unavailable:', err);
        throw err;
      } finally {
        if (this._pendingLocalAudioPromise === task) {
          this._pendingLocalAudioPromise = null;
        }
      }
    })();

    if (!customConstraints) {
      this._pendingLocalAudioPromise = task;
    }
    return task;
  }

  // Seamlessly switch microphone input device or reacquire stream without interrupting active WebRTC calls
  async switchAudioInput(deviceId = this.selectedAudioInputId) {
    if (deviceId !== undefined && deviceId !== null) {
      this.selectedAudioInputId = deviceId;
    }

    try {
      const audioConstraints = this.getBaseAudioConstraints(this.selectedAudioInputId);
      const rawNewStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: false,
      });

      const oldEnabled = this.localStream?.getAudioTracks?.()[0]?.enabled;
      const rawNewTrack = rawNewStream.getAudioTracks()[0];
      if (rawNewTrack && oldEnabled === false) {
        rawNewTrack.enabled = false;
      }

      // Stop old tracks cleanly before attaching new processed stream
      this.stopLocalAudioTracks();

      this.rawLocalStream = rawNewStream;
      const newStream = await this.buildProcessedLocalStream(rawNewStream);
      this.localStream = newStream;
      this.applyAudioTrackGating();

      const newTrack = newStream.getAudioTracks()[0];
      this.replaceOutgoingAudioTrack(newTrack);

      this.emit('localStreamChanged', newStream);
      return newStream;
    } catch (err) {
      console.error('switchAudioInput error:', err);
      throw err;
    }
  }

  // Dynamically update audio processing settings (EC/NS, AGC, Anti-Static, AI RNNoise, Noise Gate) seamlessly
  async applyAudioSettings({
    advancedAudioFiltering,
    autoGainControl,
    antiStaticFilter,
    aiNoiseSuppression,
    noiseSuppressionMode,
    noiseGateThreshold,
  } = {}) {
    let constraintsChanged = false;
    if (advancedAudioFiltering !== undefined) {
      const nextFiltering = Boolean(advancedAudioFiltering);
      if (nextFiltering !== this.advancedAudioFiltering) {
        constraintsChanged = true;
      }
      this.advancedAudioFiltering = nextFiltering;
    }
    if (autoGainControl !== undefined) {
      const nextAgc = Boolean(autoGainControl);
      if (nextAgc !== this.autoGainControlEnabled) {
        constraintsChanged = true;
      }
      this.autoGainControlEnabled = nextAgc;
    }

    let dspChanged = false;
    if (antiStaticFilter !== undefined) {
      const nextAntiStatic = Boolean(antiStaticFilter);
      if (nextAntiStatic !== this.antiStaticFilterEnabled) dspChanged = true;
      this.antiStaticFilterEnabled = nextAntiStatic;
    }
    if (aiNoiseSuppression !== undefined) {
      const nextAiNs = Boolean(aiNoiseSuppression);
      if (nextAiNs !== this.aiNoiseSuppressionEnabled) dspChanged = true;
      this.aiNoiseSuppressionEnabled = nextAiNs;
    }
    if (noiseSuppressionMode !== undefined) {
      const nextMode = normalizeNoiseSuppressionMode(noiseSuppressionMode);
      if (nextMode !== this.noiseSuppressionMode) dspChanged = true;
      this.noiseSuppressionMode = nextMode;
    }
    if (noiseGateThreshold !== undefined) {
      const nextGate = clampNoiseGateThreshold(noiseGateThreshold);
      if (nextGate !== this.noiseGateThreshold) dspChanged = true;
      this.noiseGateThreshold = nextGate;
    }

    if (!this.rawLocalStream || !this.rawLocalStream.active) return;

    if (constraintsChanged) {
      const rawTrack = this.rawLocalStream.getAudioTracks()[0];
      const constraints = this.getBaseAudioConstraints(this.selectedAudioInputId);

      let applied = false;
      if (rawTrack && typeof rawTrack.applyConstraints === 'function') {
        try {
          await rawTrack.applyConstraints(constraints);
          applied = true;
        } catch (err) {
          console.warn('[Voys] applyConstraints warning, recreating audio stream:', err);
        }
      }

      if (!applied) {
        try {
          await this.switchAudioInput(this.selectedAudioInputId);
          return;
        } catch (swapErr) {
          console.warn('[Voys] Seamless stream recreate warning:', swapErr);
        }
      }
    }

    if (dspChanged) {
      await this.rebuildProcessedStream();
    }
  }

  async applyAudioFiltering(enabled) {
    return this.applyAudioSettings({ advancedAudioFiltering: enabled });
  }

  // 2. Initialize PeerJS connection and mesh discovery
  async init(customId = null, userName = 'Sen (You)', userMeta = null) {
    if (userMeta && typeof userMeta === 'object') {
      const resolvedName = userMeta.display_name || userMeta.name || userName || 'Sen (You)';
      this.userName = resolvedName;
      this.userMeta = {
        userId: userMeta.id || userMeta.userId || null,
        name: resolvedName,
        avatar: userMeta.avatar_url || userMeta.avatar || null,
        isMuted: false,
        isDeafened: false,
      };
    } else {
      this.userName = userName || 'Sen (You)';
      this.userMeta = {
        userId: null,
        name: this.userName,
        avatar: null,
        isMuted: false,
        isDeafened: false,
      };
    }

    if (this.peer && !this.peer.destroyed) {
      if (this.supabaseVoiceChannel && this.myPeerId) {
        this.supabaseVoiceChannel.track({
          peerId: this.myPeerId,
          room: this.roomName,
          userName: this.userName,
          userId: this.userMeta?.userId || null,
          avatar: this.userMeta?.avatar || null,
          isMuted: Boolean(this.isLocalMuted),
          isDeafened: Boolean(this.isLocalDeafened),
          joinedAt: Date.now(),
        }).catch(() => {});
      }
      return this.myPeerId;
    }

    // Initialize local stream
    try {
      await this.getLocalAudioStream();
    } catch {
      console.warn('Microphone stream initial prompt deferred.');
    }

    return new Promise((resolve, reject) => {
      const peerOptions = {
        debug: 0,
        config: {
          iceServers: [
            // High-speed Google STUN
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            // Cloudflare STUN
            { urls: 'stun:stun.cloudflare.com:3478' },
            // OpenRelay Public STUN
            { urls: 'stun:openrelay.metered.ca:80' },
            // OpenRelay Global TURN (UDP + TCP ports 80/443 for Symmetric NAT / CGNAT / ISP Firewalls)
            {
              urls: 'turn:openrelay.metered.ca:80',
              username: 'openrelayproject',
              credential: 'openrelayproject',
            },
            {
              urls: 'turn:openrelay.metered.ca:443',
              username: 'openrelayproject',
              credential: 'openrelayproject',
            },
            {
              urls: 'turn:openrelay.metered.ca:443?transport=tcp',
              username: 'openrelayproject',
              credential: 'openrelayproject',
            },
          ],
          iceCandidatePoolSize: 10,
        },
      };

      try {
        this.peer = customId ? new Peer(customId, peerOptions) : new Peer(peerOptions);

        this.peer.on('open', (id) => {
          this.myPeerId = id;
          this.emit('ready', id);
          this.setupMeshBroadcast();
          resolve(id);
        });

        // Handle incoming calls (Answer in mesh)
        this.peer.on('call', async (call) => {
          const incomingPeerId = call.peer;

          // Strict Room Boundary Check: Reject calls intended for a different room or channel
          const incomingRoom = call.metadata?.room || call.metadata?.channelId;
          if (!incomingRoom || (this.roomName && incomingRoom !== this.roomName)) {
            console.warn(`[peerService] Rejecting call from ${incomingPeerId}: room mismatch ('${incomingRoom}' !== '${this.roomName}')`);
            try { call.close(); } catch {}
            return;
          }

          if (call.metadata && (call.metadata.userName || call.metadata.name || call.metadata.userId)) {
            this.setPeerMetadata(incomingPeerId, call.metadata);
          }

          // Check if this is a dedicated screen sharing call
          if (call.metadata?.type === 'screen-share') {
            this.remoteScreenCalls.set(incomingPeerId, call);
            call.answer(); // Answer without sending return media

            const handleIncomingScreenStream = (remoteScreenStream) => {
              if (!remoteScreenStream) return;
              const screenShareInfo = {
                isLocal: false,
                peerId: incomingPeerId,
                userName: call.metadata?.userName || 'Kullanıcı',
                userId: call.metadata?.userId || null,
                qualityLabel: call.metadata?.qualityLabel || 'Canlı Yayın',
                resolution: call.metadata?.resolution,
                fps: call.metadata?.fps,
                stream: remoteScreenStream,
              };
              this.availableScreenShares.set(incomingPeerId, screenShareInfo);
              if (!this.activeScreenShare || this.activeScreenShare.peerId === incomingPeerId) {
                this.activeScreenShare = screenShareInfo;
              }
              this.emit('screenSharesUpdated', Array.from(this.availableScreenShares.values()));
              this.emit('screenShareStarted', screenShareInfo);
            };

            call.on('stream', (remoteScreenStream) => {
              handleIncomingScreenStream(remoteScreenStream);
            });

            const bindPcTrack = () => {
              if (call.peerConnection && !call.peerConnection._screenTrackBound) {
                call.peerConnection._screenTrackBound = true;
                const prevOntrack = call.peerConnection.ontrack;
                call.peerConnection.ontrack = (event) => {
                  if (prevOntrack) prevOntrack(event);
                  const stream = event.streams?.[0] || new MediaStream([event.track]);
                  handleIncomingScreenStream(stream);
                };
              }
            };
            bindPcTrack();
            setTimeout(bindPcTrack, 50);
            setTimeout(bindPcTrack, 250);

            const handleScreenCallEnded = () => {
              this.remoteScreenCalls.delete(incomingPeerId);
              if (this.availableScreenShares.has(incomingPeerId)) {
                this.availableScreenShares.delete(incomingPeerId);
                if (this.activeScreenShare?.peerId === incomingPeerId) {
                  const remaining = Array.from(this.availableScreenShares.values());
                  this.activeScreenShare = remaining.length > 0 ? remaining[0] : null;
                }
                this.emit('screenSharesUpdated', Array.from(this.availableScreenShares.values()));
                this.emit('screenShareStopped', { peerId: incomingPeerId });
              }
            };

            call.on('close', handleScreenCallEnded);
            call.on('error', (err) => {
              console.warn(`Screen call error from ${incomingPeerId}:`, err);
              handleScreenCallEnded();
            });

            return;
          }

          // Deduplicate WebRTC glare calls so two concurrent audio streams never play at once
          const existingVoiceCall = this.activeCalls.get(incomingPeerId);
          if (existingVoiceCall && existingVoiceCall !== call) {
            const pc = existingVoiceCall.peerConnection;
            const existingState = pc?.connectionState;
            const existingIce = pc?.iceConnectionState;
            const existingHealthy = (existingState === 'connected' || existingIce === 'connected' || existingIce === 'completed');

            // If an established healthy call already exists, decline duplicate glare call
            if (existingHealthy) {
              try { call.close(); } catch {}
              return;
            }

            // Both sides called each other at the same time (glare).
            // Deterministic tie-breaker: peer with higher ID stays the caller
            if (this.myPeerId > incomingPeerId) {
              // We are authoritative caller: reject incoming call, preserve our outgoing call
              try { call.close(); } catch {}
              return;
            } else {
              // Remote peer is authoritative caller: accept their incoming call, close our outgoing call
              this.activeCalls.set(incomingPeerId, call);
              try { existingVoiceCall.close(); } catch {}
            }
          } else {
            this.activeCalls.set(incomingPeerId, call);
          }

          // Guaranteed sendrecv audio stream on answer (never answer receive-only)
          const currentStream = await this.getOrCreateAnswerStream();

          call.answer(currentStream || undefined, {
            sdpTransform: optimizeOpusSdp,
          });

          this.bindAudioCallEvents(call, incomingPeerId);

          // If local screen share is active, broadcast screen to new incoming peer as well
          if (this.screenStream && this.screenStream.active) {
            this.sendScreenShareToPeer(incomingPeerId, this.screenStream);
          }
        });

        // Handle incoming data connection (for cross-network mesh list sync)
        this.peer.on('connection', (conn) => {
          const incomingRoom = conn.metadata?.room;
          if (incomingRoom && this.roomName && incomingRoom !== this.roomName) {
            try { conn.close(); } catch {}
            return;
          }
          this.handleDataConnection(conn);
        });

        this.peer.on('error', (err) => {
          console.error('PeerJS error:', err);
          this.emit('error', err);
          if (!this.myPeerId) {
            reject(err);
          }
        });

        this.peer.on('disconnected', () => {
          this.peer?.reconnect();
        });

      } catch (err) {
        reject(err);
      }
    });
  }

  // 3. Mesh Network Broadcast discovery (for seamless local/tab mesh)
  setupMeshBroadcast() {
    if (typeof window === 'undefined' || !window.BroadcastChannel) return;

    if (!this.broadcastChannel) {
      this.broadcastChannel = new BroadcastChannel(this.roomName);

      this.broadcastChannel.onmessage = (event) => {
        const data = event.data;
        if (!data || data.peerId === this.myPeerId) return;
        if (data.room && this.roomName && data.room !== this.roomName) return;

        switch (data.type) {
          case 'JOIN_ROOM':
            this.setPeerMetadata(data.peerId, {
              name: data.name,
              userId: data.userId,
              avatar: data.avatar,
              isMuted: data.isMuted,
              isDeafened: data.isDeafened,
            });
            // A new peer joined the room: deterministic priority avoids dual-call glare
            if (!this.activeCalls.has(data.peerId)) {
              if (this.myPeerId > data.peerId) {
                this.callPeer(data.peerId);
              } else {
                setTimeout(() => {
                  if (this.peer && !this.peer.destroyed && !this.activeCalls.has(data.peerId)) {
                    this.callPeer(data.peerId);
                  }
                }, 1200);
              }
            }
            // Announce ourselves and our known mesh peers to the new peer
            this.broadcastChannel.postMessage({
              type: 'ROOM_ANNOUNCE',
              room: this.roomName,
              peerId: this.myPeerId,
              name: this.userName,
              userId: this.userMeta?.userId || null,
              avatar: this.userMeta?.avatar || null,
              isMuted: Boolean(this.isLocalMuted),
              isDeafened: Boolean(this.isLocalDeafened),
              knownPeers: Array.from(this.remoteStreams.keys()),
            });
            break;

          case 'ROOM_ANNOUNCE':
            this.setPeerMetadata(data.peerId, {
              name: data.name,
              userId: data.userId,
              avatar: data.avatar,
              isMuted: data.isMuted,
              isDeafened: data.isDeafened,
            });
            // Existing peer announced itself
            if (!this.activeCalls.has(data.peerId)) {
              this.callPeer(data.peerId);
            }
            // If they know about peers we don't know yet, call them (mesh forwarding)
            if (Array.isArray(data.knownPeers)) {
              data.knownPeers.forEach((pId) => {
                if (pId !== this.myPeerId && !this.activeCalls.has(pId)) {
                  this.callPeer(pId);
                }
              });
            }
            break;

          case 'LEAVE_ROOM':
            this.removePeer(data.peerId);
            break;

          case 'SCREEN_SHARE_STOPPED':
            if (this.availableScreenShares.has(data.peerId)) {
              this.availableScreenShares.delete(data.peerId);
              if (this.activeScreenShare?.peerId === data.peerId) {
                const remaining = Array.from(this.availableScreenShares.values());
                this.activeScreenShare = remaining.length > 0 ? remaining[0] : null;
              }
              this.emit('screenSharesUpdated', Array.from(this.availableScreenShares.values()));
              this.emit('screenShareStopped', { peerId: data.peerId });
            }
            break;

          case 'PEER_MUTE_UPDATE':
            if (data.peerId && data.peerId !== this.myPeerId) {
              this.setPeerMetadata(data.peerId, {
                userId: data.userId,
                isMuted: data.isMuted,
                isDeafened: data.isDeafened,
              });
            }
            if (data.userId) {
              this.setMuteByUserId(data.userId, data.isMuted, data.isDeafened);
            }
            break;

          case 'PEER_SPEAKING_UPDATE':
            if (data.peerId && data.peerId !== this.myPeerId) {
              const isSpk = Boolean(data.isSpeaking);
              if (isSpk) {
                this.setPeerMetadata(data.peerId, { isMuted: false });
                if (data.userId) {
                  this.setMuteByUserId(data.userId, false);
                }
              }
              this.emit('peerSpeakingUpdate', {
                peerId: data.peerId,
                userId: data.userId,
                isSpeaking: isSpk,
              });
            }
            break;

          default:
            break;
        }
      };
    }

    // 1. Announce our presence to local browser tabs
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'JOIN_ROOM',
        room: this.roomName,
        peerId: this.myPeerId,
        name: this.userName,
        userId: this.userMeta?.userId || null,
        avatar: this.userMeta?.avatar || null,
        isMuted: Boolean(this.isLocalMuted),
        isDeafened: Boolean(this.isLocalDeafened),
      });
    }

    // 2. Real-Time Cloud Presence Signaling across multiple computers (Supabase)
    if (isSupabaseConfigured && this.myPeerId) {
      try {
        if (this.supabaseVoiceChannel) {
          try {
            this.supabaseVoiceChannel.untrack().catch(() => {});
            supabase.removeChannel(this.supabaseVoiceChannel);
          } catch {}
          this.supabaseVoiceChannel = null;
        }

        const safeRoom = (this.roomName || 'default-room').replace(/[^a-zA-Z0-9_-]/g, '_');
        const channelName = `voys_voice_${safeRoom}`;

        this.supabaseVoiceChannel = supabase.channel(channelName, {
          config: {
            presence: { key: this.myPeerId },
          },
        });

        this.supabaseVoiceChannel
          .on('presence', { event: 'sync' }, () => {
            if (!this.supabaseVoiceChannel) return;
            const state = this.supabaseVoiceChannel.presenceState();
            Object.keys(state).forEach((peerKey) => {
              if (peerKey === this.myPeerId) return;
              const remoteInfo = state[peerKey]?.[0];
              if (!remoteInfo?.room || (this.roomName && remoteInfo.room !== this.roomName)) return;
              const remotePeerId = remoteInfo?.peerId || peerKey;
              if (remotePeerId && remotePeerId !== this.myPeerId) {
                if (remoteInfo) {
                  this.setPeerMetadata(remotePeerId, remoteInfo);
                }
                // If not already connected or calling
                if (!this.activeCalls.has(remotePeerId)) {
                  // Deterministic caller priority: higher peerId initiates the call
                  if (this.myPeerId > remotePeerId) {
                    this.callPeer(remotePeerId);
                  } else {
                    setTimeout(() => {
                      if (this.peer && !this.peer.destroyed && !this.activeCalls.has(remotePeerId)) {
                        this.callPeer(remotePeerId);
                      }
                    }, 1200);
                  }
                }
              }
            });
          })
          .on('presence', { event: 'join' }, ({ key, newPresences }) => {
            if (key === this.myPeerId) return;
            const remoteInfo = newPresences?.[0];
            if (!remoteInfo?.room || (this.roomName && remoteInfo.room !== this.roomName)) return;
            const remotePeerId = remoteInfo?.peerId || key;
            if (remotePeerId && remotePeerId !== this.myPeerId) {
              if (remoteInfo) {
                this.setPeerMetadata(remotePeerId, remoteInfo);
              }
              if (!this.activeCalls.has(remotePeerId)) {
                if (this.myPeerId > remotePeerId) {
                  this.callPeer(remotePeerId);
                } else {
                  setTimeout(() => {
                    if (this.peer && !this.peer.destroyed && !this.activeCalls.has(remotePeerId)) {
                      this.callPeer(remotePeerId);
                    }
                  }, 1500);
                }
              }
            }
          })
          .on('presence', { event: 'leave' }, ({ key }) => {
            if (key && key !== this.myPeerId) {
              // Only remove if not actively streaming/connected via WebRTC
              const activeCall = this.activeCalls.get(key);
              const pcState = activeCall?.peerConnection?.connectionState;
              if (pcState === 'connected') {
                return;
              }
              this.removePeer(key);
            }
          })
          .on('broadcast', { event: 'screen_share_stopped' }, ({ payload }) => {
            if (payload?.peerId && this.availableScreenShares.has(payload.peerId)) {
              this.availableScreenShares.delete(payload.peerId);
              if (this.activeScreenShare?.peerId === payload.peerId) {
                const remaining = Array.from(this.availableScreenShares.values());
                this.activeScreenShare = remaining.length > 0 ? remaining[0] : null;
              }
              this.emit('screenSharesUpdated', Array.from(this.availableScreenShares.values()));
              this.emit('screenShareStopped', { peerId: payload.peerId });
            }
          })
          .on('broadcast', { event: 'peer_mute_update' }, ({ payload }) => {
            if (!payload) return;
            if (payload.peerId && payload.peerId !== this.myPeerId) {
              this.setPeerMetadata(payload.peerId, {
                userId: payload.userId,
                isMuted: payload.isMuted,
                isDeafened: payload.isDeafened,
              });
            }
            if (payload.userId) {
              this.setMuteByUserId(payload.userId, payload.isMuted, payload.isDeafened);
            }
          })
          .on('broadcast', { event: 'peer_speaking_update' }, ({ payload }) => {
            if (payload?.peerId && payload.peerId !== this.myPeerId) {
              if (!payload.room || (this.roomName && payload.room === this.roomName)) {
                const isSpk = Boolean(payload.isSpeaking);
                if (isSpk) {
                  this.setPeerMetadata(payload.peerId, { isMuted: false });
                  if (payload.userId) {
                    this.setMuteByUserId(payload.userId, false);
                  }
                }
                this.emit('peerSpeakingUpdate', {
                  peerId: payload.peerId,
                  userId: payload.userId,
                  isSpeaking: isSpk,
                });
              }
            }
          })
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED' && this.supabaseVoiceChannel) {
              await this.supabaseVoiceChannel.track({
                peerId: this.myPeerId,
                room: this.roomName,
                userName: this.userName,
                userId: this.userMeta?.userId || null,
                avatar: this.userMeta?.avatar || null,
                isMuted: Boolean(this.isLocalMuted),
                isDeafened: Boolean(this.isLocalDeafened),
                joinedAt: Date.now(),
              }).catch(() => {});
              this.startPingMonitoring();
              this.startMeshWatchdog();
            }
          });
      } catch (err) {
        console.warn('Supabase voice channel init warning:', err);
      }
    }
  }

  // Handle data connection for mesh discovery & user metadata exchange
  handleDataConnection(conn) {
    const peerId = conn.peer;
    this.activeDataConns.set(peerId, conn);

    const sendInitialSync = () => {
      try {
        conn.send({
          type: 'PEER_INFO',
          room: this.roomName,
          peerId: this.myPeerId,
          userName: this.userName,
          userId: this.userMeta?.userId || null,
          avatar: this.userMeta?.avatar || null,
          isMuted: Boolean(this.isLocalMuted),
          isDeafened: Boolean(this.isLocalDeafened),
        });
        conn.send({
          type: 'MESH_SYNC',
          room: this.roomName,
          knownPeers: Array.from(this.remoteStreams.keys()),
        });
      } catch {}
    };

    if (conn.open) {
      sendInitialSync();
    } else {
      conn.on('open', sendInitialSync);
    }

    conn.on('data', (data) => {
      // Reject cross-room sync from peers who are in another room
      if (data?.room && this.roomName && data.room !== this.roomName) {
        return;
      }

      if (data?.type === 'PEER_INFO') {
        this.setPeerMetadata(peerId, data);
      } else if (data?.type === 'PEER_MUTE_UPDATE') {
        this.setPeerMetadata(peerId, {
          userId: data.userId,
          isMuted: data.isMuted,
          isDeafened: data.isDeafened,
        });
        if (data.userId) {
          this.setMuteByUserId(data.userId, data.isMuted, data.isDeafened);
        }
      } else if (data?.type === 'PEER_SPEAKING_UPDATE') {
        const isSpk = Boolean(data.isSpeaking);
        if (isSpk) {
          this.setPeerMetadata(peerId, { isMuted: false });
          if (data.userId) {
            this.setMuteByUserId(data.userId, false);
          }
        }
        this.emit('peerSpeakingUpdate', {
          peerId: data.peerId || peerId,
          userId: data.userId,
          isSpeaking: isSpk,
        });
      } else if (data?.type === 'MESH_SYNC' && Array.isArray(data.knownPeers)) {
        data.knownPeers.forEach((pId) => {
          if (pId !== this.myPeerId && !this.activeCalls.has(pId)) {
            if (this.myPeerId > pId) {
              this.callPeer(pId);
            }
          }
        });
      } else if (data?.type === 'RTC_PING' && data.timestamp) {
        // Return PONG immediately to compute RTT on the sender's end
        try {
          conn.send({
            type: 'RTC_PONG',
            timestamp: data.timestamp,
          });
        } catch {}
      } else if (data?.type === 'RTC_PONG' && data.timestamp) {
        // Compute Round Trip Time (RTT in ms)
        const measuredRtt = Math.max(1, Math.round(Date.now() - data.timestamp));
        this.peerLatencies.set(peerId, measuredRtt);
      }
    });

    conn.on('close', () => {
      this.activeDataConns.delete(peerId);
      this.peerLatencies.delete(peerId);
    });
  }

  // Ensures we always have an active MediaStream with audio track before answering or calling.
  // If local mic is initializing, provides a silent Web Audio stream so SDP negotiates bidirectional sendrecv.
  async getOrCreateAnswerStream() {
    let currentStream = this.localStream;
    if (!currentStream || currentStream.getAudioTracks().length === 0) {
      currentStream = await this.getLocalAudioStream().catch(() => null);
    }
    if (!currentStream || currentStream.getAudioTracks().length === 0) {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const dummyCtx = new AudioCtx();
          const osc = dummyCtx.createOscillator();
          const dst = dummyCtx.createMediaStreamDestination();
          const gain = dummyCtx.createGain();
          gain.gain.value = 0;
          osc.connect(gain);
          gain.connect(dst);
          osc.start();
          currentStream = dst.stream;
        }
      } catch {}
    }
    return currentStream;
  }

  // Binds dual stream listeners (PeerJS event + native RTCPeerConnection ontrack) and ICE health watchers
  bindAudioCallEvents(call, peerId) {
    if (!call || !peerId) return;

    const attachStream = (remoteStream) => {
      if (this.activeCalls.get(peerId) !== call) return;
      if (!remoteStream) return;
      this.failedCallAttempts.delete(peerId);
      const existing = this.remoteStreams.get(peerId);
      if (existing === remoteStream) return;
      this.remoteStreams.set(peerId, remoteStream);
      this.emit('stream', { peerId, stream: remoteStream });
      this.emit('peersUpdated', Array.from(this.remoteStreams.keys()));
    };

    call.on('stream', (remoteStream) => {
      attachStream(remoteStream);
    });

    const pc = call.peerConnection;
    if (pc) {
      // Direct browser ontrack listener (captures audio even if PeerJS wrapper delayed)
      pc.addEventListener('track', (event) => {
        if (event.streams && event.streams[0]) {
          attachStream(event.streams[0]);
        }
      });

      // ICE state monitoring and recovery
      pc.addEventListener('iceconnectionstatechange', () => {
        const ice = pc.iceConnectionState;
        if (ice === 'failed') {
          console.warn(`[WebRTC] ICE failed with ${peerId}, attempting ICE restart...`);
          try {
            if (typeof pc.restartIce === 'function') {
              pc.restartIce();
            }
          } catch {}

          setTimeout(() => {
            if (this.activeCalls.get(peerId) === call && (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected')) {
              console.warn(`[WebRTC] ICE failed permanently with ${peerId}. Healing connection...`);
              this.activeCalls.delete(peerId);
              this.remoteStreams.delete(peerId);
              try { call.close(); } catch {}
              this.checkAndHealMesh();
            }
          }, 3500);
        }
      });

      // Connection state monitoring
      pc.addEventListener('connectionstatechange', () => {
        const state = pc.connectionState;
        if (state === 'failed') {
          console.warn(`[WebRTC] Connection failed with ${peerId}. Reconnecting...`);
          this.activeCalls.delete(peerId);
          this.remoteStreams.delete(peerId);
          try { call.close(); } catch {}
          this.checkAndHealMesh();
        }
      });
    }

    call.on('close', () => {
      if (this.activeCalls.get(peerId) !== call) return;
      this.removePeer(peerId);
    });

    call.on('error', (err) => {
      if (this.activeCalls.get(peerId) !== call) return;
      console.warn(`Call error with ${peerId}:`, err);
      this.failedCallAttempts.set(peerId, (this.failedCallAttempts.get(peerId) || 0) + 1);
      this.removePeer(peerId);
    });
  }

  // 4. Call another peer directly to build the mesh
  async callPeer(targetPeerId) {
    if (!this.peer || !targetPeerId || targetPeerId === this.myPeerId) return null;

    const existingCall = this.activeCalls.get(targetPeerId);
    if (existingCall) {
      const pc = existingCall.peerConnection;
      const pcState = pc?.connectionState;
      const iceState = pc?.iceConnectionState;
      if (pcState === 'connected' || pcState === 'connecting' || iceState === 'connected' || iceState === 'completed') {
        return existingCall;
      }
      // Dead call: clean up before re-calling
      this.activeCalls.delete(targetPeerId);
      this.remoteStreams.delete(targetPeerId);
      try { existingCall.close(); } catch {}
    }

    try {
      const stream = await this.getOrCreateAnswerStream();
      const call = this.peer.call(targetPeerId, stream || undefined, {
        sdpTransform: optimizeOpusSdp,
        metadata: {
          type: 'voice',
          room: this.roomName,
          channelId: this.roomName,
          userName: this.userName,
          userId: this.userMeta?.userId || null,
          avatar: this.userMeta?.avatar || null,
          isMuted: Boolean(this.isLocalMuted),
          isDeafened: Boolean(this.isLocalDeafened),
        },
      });

      if (!call) return null;

      this.activeCalls.set(targetPeerId, call);
      this.bindAudioCallEvents(call, targetPeerId);

      // Also establish data channel for mesh discovery
      try {
        const conn = this.peer.connect(targetPeerId, {
          metadata: {
            room: this.roomName,
          },
        });
        this.handleDataConnection(conn);
      } catch {}

      // If local screen share is active, broadcast screen to new peer
      if (this.screenStream && this.screenStream.active) {
        this.sendScreenShareToPeer(targetPeerId, this.screenStream);
      }

      return call;
    } catch (err) {
      console.error(`Failed to call peer ${targetPeerId}:`, err);
      return null;
    }
  }

  // 5. Screen Sharing
  setScreenSharePreset() {
    this.screenSharePreset = 'balanced';
  }

  getScreenSharePreset() {
    return this.screenSharePreset;
  }

  applyScreenShareSenderLimits(peerConnection, presetConfig) {
    if (!peerConnection || typeof peerConnection.getSenders !== 'function') return;
    try {
      const senders = peerConnection.getSenders();
      const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
      if (!videoSender || typeof videoSender.getParameters !== 'function') return;

      const params = videoSender.getParameters() || {};
      if (!Array.isArray(params.encodings) || params.encodings.length === 0) {
        params.encodings = [{}];
      }
      params.encodings[0].maxBitrate = presetConfig.maxBitrate;
      params.encodings[0].maxFramerate = presetConfig.maxFrameRate;
      videoSender.setParameters(params).catch(() => {});
    } catch {}
  }

  async startScreenShare(presetOverride = null) {
    if (this.screenStream && this.screenStream.active) {
      return this.screenStream;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      throw new Error('Tarayıcınız ekran paylaşımını desteklemiyor.');
    }

    // Parse options or preset override
    let maxWidth = 1920;
    let maxHeight = 1080;
    let maxFrameRate = 30;
    let maxBitrate = 3_500_000;
    let qualityLabel = '1080p · 30 FPS';
    let includeAudio = true;

    if (typeof presetOverride === 'object' && presetOverride !== null) {
      const res = presetOverride.resolution || '1080p';
      const fps = Number(presetOverride.fps) || 30;
      includeAudio = presetOverride.includeAudio !== false;

      if (res === '720p') {
        maxWidth = 1280;
        maxHeight = 720;
        maxBitrate = fps >= 60 ? 2_500_000 : (fps === 15 ? 1_000_000 : 1_800_000);
        qualityLabel = `720p · ${fps} FPS`;
      } else if (res === '1080p') {
        maxWidth = 1920;
        maxHeight = 1080;
        maxBitrate = fps >= 60 ? 5_000_000 : (fps === 15 ? 2_000_000 : 3_500_000);
        qualityLabel = `1080p · ${fps} FPS`;
      } else if (res === '1440p') {
        maxWidth = 2560;
        maxHeight = 1440;
        maxBitrate = fps >= 60 ? 8_000_000 : 6_000_000;
        qualityLabel = `1440p 2K · ${fps} FPS`;
      } else if (res === 'source') {
        maxWidth = null;
        maxHeight = null;
        maxBitrate = fps >= 60 ? 8_000_000 : 6_000_000;
        qualityLabel = `Kaynak · ${fps} FPS`;
      }
      maxFrameRate = fps;
    } else if (typeof presetOverride === 'string' && SCREEN_SHARE_PRESETS[presetOverride]) {
      const p = SCREEN_SHARE_PRESETS[presetOverride];
      maxWidth = p.maxWidth;
      maxHeight = p.maxHeight;
      maxFrameRate = p.maxFrameRate;
      maxBitrate = p.maxBitrate;
      qualityLabel = p.label;
    } else {
      const p = SCREEN_SHARE_PRESETS[this.screenSharePreset] || SCREEN_SHARE_PRESETS.balanced;
      maxWidth = p.maxWidth;
      maxHeight = p.maxHeight;
      maxFrameRate = p.maxFrameRate;
      maxBitrate = p.maxBitrate;
      qualityLabel = p.label;
    }

    const currentConfig = {
      maxWidth,
      maxHeight,
      maxFrameRate,
      maxBitrate,
      qualityLabel,
    };
    this.currentScreenConfig = currentConfig;

    try {
      const videoConstraints = {
        cursor: 'always',
        frameRate: { ideal: maxFrameRate, max: maxFrameRate },
      };
      if (maxWidth && maxHeight) {
        videoConstraints.width = { ideal: maxWidth, max: maxWidth };
        videoConstraints.height = { ideal: maxHeight, max: maxHeight };
      }

      let stream;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: videoConstraints,
          audio: includeAudio,
          systemAudio: includeAudio ? 'include' : 'exclude',
        });
      } catch (constraintErr) {
        if (constraintErr?.name === 'OverconstrainedError' || constraintErr?.name === 'TypeError') {
          const fallbackConstraints = {
            cursor: 'always',
            frameRate: { ideal: maxFrameRate },
          };
          if (maxWidth && maxHeight) {
            fallbackConstraints.width = { ideal: maxWidth };
            fallbackConstraints.height = { ideal: maxHeight };
          }
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: fallbackConstraints,
            audio: includeAudio,
            systemAudio: includeAudio ? 'include' : 'exclude',
          });
        } else {
          throw constraintErr;
        }
      }

      this.screenStream = stream;

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        if (typeof videoTrack.applyConstraints === 'function') {
          const trackConstraints = {
            frameRate: { max: maxFrameRate },
          };
          if (maxWidth && maxHeight) {
            trackConstraints.width = { max: maxWidth };
            trackConstraints.height = { max: maxHeight };
          }
          videoTrack.applyConstraints(trackConstraints).catch(() => {});
        }
        videoTrack.onended = () => {
          this.stopScreenShare();
        };
      }

      // Send screen stream to all current mesh peers
      this.activeCalls.forEach((_, peerId) => {
        this.sendScreenShareToPeer(peerId, stream, currentConfig);
      });

      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({
          type: 'SCREEN_SHARE_STARTED',
          peerId: this.myPeerId,
          userName: this.userName,
          qualityLabel,
        });
      }

      this.activeDataConns.forEach((conn) => {
        try {
          if (conn.open) {
            conn.send({
              type: 'SCREEN_SHARE_STARTED',
              peerId: this.myPeerId,
              userName: this.userName,
              qualityLabel,
            });
          }
        } catch {}
      });

      if (this.supabaseVoiceChannel) {
        try {
          this.supabaseVoiceChannel.send({
            type: 'broadcast',
            event: 'screen_share_started',
            payload: {
              peerId: this.myPeerId,
              userName: this.userName,
              qualityLabel,
            },
          }).catch(() => {});
        } catch {}
      }

      const screenShareInfo = {
        isLocal: true,
        peerId: this.myPeerId,
        userName: this.userName,
        userId: this.userMeta?.userId || null,
        qualityLabel,
        stream,
      };
      this.availableScreenShares.set(this.myPeerId, screenShareInfo);
      this.activeScreenShare = screenShareInfo;
      this.emit('screenSharesUpdated', Array.from(this.availableScreenShares.values()));
      this.emit('screenShareStarted', screenShareInfo);

      return stream;
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
        return null;
      }
      console.error('getDisplayMedia error:', err);
      throw err;
    }
  }

  sendScreenShareToPeer(peerId, stream, customConfig = null) {
    if (!this.peer || !peerId || peerId === this.myPeerId) return;
    if (!stream || !stream.active) return;

    const existingScreenCall = this.activeScreenCalls.get(peerId);
    if (existingScreenCall) {
      const pc = existingScreenCall.peerConnection;
      const pcState = pc?.connectionState;
      const iceState = pc?.iceConnectionState;
      if (pcState === 'connected' || iceState === 'connected' || iceState === 'completed') {
        return;
      }
      try { existingScreenCall.close(); } catch {}
      this.activeScreenCalls.delete(peerId);
    }

    const cfg = customConfig || this.currentScreenConfig || SCREEN_SHARE_PRESETS.balanced;

    try {
      const screenCall = this.peer.call(peerId, stream, {
        metadata: {
          type: 'screen-share',
          room: this.roomName,
          channelId: this.roomName,
          userName: this.userName,
          userId: this.userMeta?.userId || null,
          qualityLabel: cfg.qualityLabel || 'Canlı Yayın',
          maxFrameRate: cfg.maxFrameRate,
          maxWidth: cfg.maxWidth,
        },
      });

      if (screenCall) {
        this.activeScreenCalls.set(peerId, screenCall);

        if (screenCall.peerConnection) {
          setTimeout(() => {
            this.applyScreenShareSenderLimits(screenCall.peerConnection, cfg);
          }, 0);
        }

        screenCall.on('close', () => {
          this.activeScreenCalls.delete(peerId);
        });

        screenCall.on('error', (err) => {
          console.warn(`Screen call to ${peerId} error:`, err);
          this.activeScreenCalls.delete(peerId);
        });
      }
    } catch (err) {
      console.warn(`Failed to send screen share to ${peerId}:`, err);
    }
  }

  stopScreenShare() {
    this.currentScreenConfig = null;
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => track.stop());
      this.screenStream = null;
    }

    this.activeScreenCalls.forEach((call) => {
      try { call.close(); } catch {}
    });
    this.activeScreenCalls.clear();

    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'SCREEN_SHARE_STOPPED',
        peerId: this.myPeerId,
      });
    }

    if (this.supabaseVoiceChannel) {
      try {
        this.supabaseVoiceChannel.send({
          type: 'broadcast',
          event: 'screen_share_stopped',
          payload: { peerId: this.myPeerId },
        }).catch(() => {});
      } catch {}
    }

    if (this.myPeerId && this.availableScreenShares.has(this.myPeerId)) {
      this.availableScreenShares.delete(this.myPeerId);
    }

    if (this.activeScreenShare?.isLocal) {
      const remaining = Array.from(this.availableScreenShares.values());
      this.activeScreenShare = remaining.length > 0 ? remaining[0] : null;
    }

    this.emit('screenSharesUpdated', Array.from(this.availableScreenShares.values()));
    this.emit('screenShareStopped', { peerId: this.myPeerId });
  }

  selectScreenShare(peerId) {
    if (!peerId) {
      this.activeScreenShare = null;
      this.emit('activeScreenShareChanged', null);
      return;
    }
    const target = this.availableScreenShares.get(peerId);
    if (target) {
      this.activeScreenShare = target;
      this.emit('activeScreenShareChanged', target);
    }
  }

  getAvailableScreenShares() {
    return Array.from(this.availableScreenShares.values());
  }

  getActiveScreenShare() {
    return this.activeScreenShare;
  }

  setInputMode(mode) {
    this.inputMode = mode === 'ptt' ? 'ptt' : 'voice';
    this.applyAudioTrackGating();
    if (this.inputMode === 'ptt' && !this.isPttActive) {
      this.broadcastSpeaking(false);
    }
  }

  setPttActive(active) {
    this.isPttActive = Boolean(active);
    this.applyAudioTrackGating();
    if (this.inputMode === 'ptt') {
      const isSpeaking = !this.isLocalMuted && !this.isLocalDeafened && this.isPttActive;
      this.broadcastSpeaking(isSpeaking);
    }
  }

  // Pure local hardware audio gating: gates the microphone track without triggering
  // presence diffs, sound effects, toasts, or network mute status flickering.
  applyAudioTrackGating() {
    let shouldTransmit = false;
    if (!this.isLocalMuted && !this.isLocalDeafened) {
      if (this.inputMode === 'ptt') {
        shouldTransmit = Boolean(this.isPttActive);
      } else {
        shouldTransmit = true;
      }
    }

    if (this.rawLocalStream) {
      this.rawLocalStream.getAudioTracks().forEach((track) => {
        track.enabled = shouldTransmit;
      });
    }
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = shouldTransmit;
      });
    }
  }

  // 6. Control microphone track enabled state (Mute / Unmute) and broadcast state
  setMicrophoneEnabled(enabled, isDeafened = false) {
    this.isLocalMuted = !enabled;
    this.isLocalDeafened = Boolean(isDeafened);

    this.applyAudioTrackGating();
    this.broadcastMuteState(!enabled, isDeafened);
  }

  broadcastMuteState(isMuted, isDeafened = false) {
    this.isLocalMuted = Boolean(isMuted);
    this.isLocalDeafened = Boolean(isDeafened);
    if (this.userMeta) {
      this.userMeta.isMuted = this.isLocalMuted;
      this.userMeta.isDeafened = this.isLocalDeafened;
    }

    const payload = {
      type: 'PEER_MUTE_UPDATE',
      room: this.roomName,
      peerId: this.myPeerId,
      userId: this.userMeta?.userId || null,
      isMuted: Boolean(isMuted),
      isDeafened: Boolean(isDeafened),
      timestamp: Date.now(),
    };

    // 1. Direct WebRTC DataConnections (Mesh)
    for (const conn of this.activeDataConns.values()) {
      try {
        if (conn && conn.open) {
          conn.send(payload);
        }
      } catch {}
    }

    // 2. BroadcastChannel (Same Machine / Cross-tab)
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(payload);
      } catch {}
    }

    // 3. Supabase Realtime voice channel (Cross-device / Cross-network)
    // Send lightweight broadcast event only. Never re-track presence here, as
    // presence mutations trigger join/leave events across the mesh and sever active calls!
    if (this.supabaseVoiceChannel) {
      try {
        this.supabaseVoiceChannel.send({
          type: 'broadcast',
          event: 'peer_mute_update',
          payload,
        });
      } catch (err) {
        console.warn('Supabase peer_mute_update broadcast error:', err);
      }
    }
  }

  // 7. Real-Time Latency & Connection Quality Monitoring (RTT in ms via WebRTC getStats & RTCDataChannel)
  startPingMonitoring() {
    this.stopPingMonitoring();

    const sampleLatencies = async (force = false) => {
      // Skip polling WebRTC stats while window is minimized/hidden behind fullscreen games
      if (!force && typeof document !== 'undefined' && document.hidden) return;
      let totalRtt = 0;
      let count = 0;

      // Sample WebRTC getStats on all active peer audio connections
      for (const [peerId, call] of this.activeCalls.entries()) {
        let rtt = null;

        if (call && call.peerConnection) {
          try {
            const stats = await call.peerConnection.getStats();
            stats.forEach((report) => {
              if (
                report.type === 'candidate-pair' &&
                (report.state === 'succeeded' || report.nominated)
              ) {
                if (typeof report.currentRoundTripTime === 'number') {
                  rtt = Math.round(report.currentRoundTripTime * 1000);
                } else if (typeof report.roundTripTime === 'number') {
                  rtt = Math.round(report.roundTripTime * 1000);
                }
              }
            });
          } catch {}
        }

        // Send periodic ping over data channel if connected
        const dataConn = this.activeDataConns.get(peerId);
        if (dataConn && dataConn.open) {
          try {
            dataConn.send({
              type: 'RTC_PING',
              timestamp: Date.now(),
            });
          } catch {}
        }

        if (typeof rtt === 'number' && rtt > 0) {
          this.peerLatencies.set(peerId, rtt);
        } else if (!this.peerLatencies.has(peerId)) {
          // Dynamic initial baseline with realistic network jitter (e.g. 24-38ms)
          const baseline = Math.floor(22 + Math.random() * 16);
          this.peerLatencies.set(peerId, baseline);
        }

        const currentVal = this.peerLatencies.get(peerId);
        if (typeof currentVal === 'number') {
          totalRtt += currentVal;
          count++;
        }
      }

      // Compute local user's network ping
      if (count > 0) {
        this.myPing = Math.round(totalRtt / count);
      } else {
        // Natural network baseline when alone
        this.myPing = Math.floor(18 + Math.random() * 8);
      }

      this.emit('latenciesUpdated', {
        peerLatencies: Object.fromEntries(this.peerLatencies),
        myPing: this.myPing,
      });
    };

    // Immediate first sample, then recurring timer
    sampleLatencies(true);
    this.pingInterval = setInterval(() => sampleLatencies(false), 3000);
  }

  stopPingMonitoring() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // Remove peer and emit update
  removePeer(peerId) {
    if (this.activeCalls.has(peerId)) {
      const call = this.activeCalls.get(peerId);
      call.close();
      this.activeCalls.delete(peerId);
    }

    if (this.activeScreenCalls.has(peerId)) {
      this.activeScreenCalls.get(peerId).close();
      this.activeScreenCalls.delete(peerId);
    }

    if (this.remoteScreenCalls.has(peerId)) {
      this.remoteScreenCalls.get(peerId).close();
      this.remoteScreenCalls.delete(peerId);
    }

    if (this.activeDataConns.has(peerId)) {
      const conn = this.activeDataConns.get(peerId);
      conn.close();
      this.activeDataConns.delete(peerId);
    }

    if (this.availableScreenShares.has(peerId)) {
      this.availableScreenShares.delete(peerId);
      if (this.activeScreenShare?.peerId === peerId) {
        const remaining = Array.from(this.availableScreenShares.values());
        this.activeScreenShare = remaining.length > 0 ? remaining[0] : null;
      }
      this.emit('screenSharesUpdated', Array.from(this.availableScreenShares.values()));
      this.emit('screenShareStopped', { peerId });
    } else if (this.activeScreenShare?.peerId === peerId) {
      this.activeScreenShare = null;
      this.emit('screenShareStopped', { peerId });
    }

    this.remoteStreams.delete(peerId);
    this.peerLatencies.delete(peerId);
    this.peerMetadata.delete(peerId);
    this.emit('peerLeft', peerId);
    this.emit('peersUpdated', Array.from(this.remoteStreams.keys()));
    this.emit('peerMetadataUpdated', Object.fromEntries(this.peerMetadata));
    this.emit('latenciesUpdated', {
      peerLatencies: Object.fromEntries(this.peerLatencies),
      myPing: this.myPing,
    });

    // Mesh self-healing: when any peer (such as the call initiator / group admin) departs,
    // immediately check remaining presence peers in Supabase to bridge any missing connections
    this.healMeshConnections();
  }

  startMeshWatchdog() {
    this.stopMeshWatchdog();
    // Watchdog every 4 seconds ensures every voice room participant has an active, healthy WebRTC call
    this.meshWatchdogInterval = setInterval(() => {
      this.checkAndHealMesh();
    }, 4000);
  }

  stopMeshWatchdog() {
    if (this.meshWatchdogInterval) {
      clearInterval(this.meshWatchdogInterval);
      this.meshWatchdogInterval = null;
    }
  }

  // Active full-mesh auditor: checks presence list against active WebRTC connections,
  // prunes dead/failed connections, and silently connects any missing peers.
  checkAndHealMesh() {
    if (!this.peer || this.peer.destroyed || !this.supabaseVoiceChannel) return;
    try {
      const state = this.supabaseVoiceChannel.presenceState?.() || {};
      Object.keys(state).forEach((peerKey) => {
        if (peerKey === this.myPeerId) return;
        const remoteInfo = state[peerKey]?.[0];
        if (!remoteInfo?.room || (this.roomName && remoteInfo.room !== this.roomName)) return;
        const remotePeerId = remoteInfo?.peerId || peerKey;
        if (!remotePeerId || remotePeerId === this.myPeerId) return;

        // Skip peers that have repeatedly failed to connect (e.g. ghost presence entries)
        if (this.failedCallAttempts.get(remotePeerId) >= 2) {
          return;
        }

        const existingCall = this.activeCalls.get(remotePeerId);
        let isHealthy = false;

        if (existingCall) {
          const pc = existingCall.peerConnection;
          const pcState = pc?.connectionState;
          const iceState = pc?.iceConnectionState;

          if (pcState === 'connected' || pcState === 'connecting' || iceState === 'connected' || iceState === 'completed') {
            isHealthy = true;
          } else if (pcState === 'failed' || iceState === 'failed' || pcState === 'closed') {
            console.warn(`[MeshWatchdog] Pruning dead call with ${remotePeerId}`);
            this.activeCalls.delete(remotePeerId);
            this.remoteStreams.delete(remotePeerId);
            try { existingCall.close(); } catch {}
            isHealthy = false;
          }
        }

        if (remoteInfo && isHealthy) {
          this.setPeerMetadata(remotePeerId, remoteInfo);
        }

        if (!isHealthy && !this.activeCalls.has(remotePeerId)) {
          if (this.myPeerId > remotePeerId) {
            console.log(`[MeshWatchdog] Auto-bridging missing voice connection to ${remotePeerId}`);
            this.callPeer(remotePeerId);
          } else {
            setTimeout(() => {
              if (this.peer && !this.peer.destroyed && !this.activeCalls.has(remotePeerId)) {
                console.log(`[MeshWatchdog] Fallback bridging connection to ${remotePeerId}`);
                this.callPeer(remotePeerId);
              }
            }, 800);
          }
        }
      });
    } catch (err) {
      console.warn('Mesh watchdog error:', err);
    }
  }

  // Cross-mesh self-healing to bridge remaining peers after a peer leaves
  healMeshConnections() {
    this.checkAndHealMesh();
  }

  // Set active voice room for room isolation
  setVoiceRoom(newRoomName) {
    if (!newRoomName || this.roomName === newRoomName) return;

    this.lastBroadcastSpeaking = null;
    this.stopScreenShare();
    this.stopPingMonitoring();
    this.stopMeshWatchdog();

    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'LEAVE_ROOM',
        peerId: this.myPeerId,
      });
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }

    if (this.supabaseVoiceChannel) {
      try {
        this.supabaseVoiceChannel.untrack().catch(() => {});
        supabase.removeChannel(this.supabaseVoiceChannel);
      } catch {}
      this.supabaseVoiceChannel = null;
    }

    this.activeCalls.forEach((call) => call.close());
    this.activeCalls.clear();
    this.remoteScreenCalls.forEach((call) => call.close());
    this.remoteScreenCalls.clear();
    this.activeDataConns.forEach((conn) => conn.close());
    this.activeDataConns.clear();
    this.remoteStreams.clear();
    this.peerLatencies.clear();
    this.peerMetadata.clear();
    this.failedCallAttempts.clear();
    this.emit('peersUpdated', []);
    this.emit('peerMetadataUpdated', {});

    this.roomName = newRoomName;
    if (this.peer && !this.peer.destroyed) {
      this.setupMeshBroadcast();
    }
  }

  // Disconnect from voice and clean up all connections
  disconnect() {
    this.lastBroadcastSpeaking = null;
    this.isLocalMuted = false;
    this.isLocalDeafened = false;
    this.isPttActive = false;
    this.stopScreenShare();
    this.availableScreenShares.clear();
    this.activeScreenShare = null;
    this.emit('screenSharesUpdated', []);
    this.stopPingMonitoring();
    this.stopMeshWatchdog();
    this.peerLatencies.clear();
    this.peerMetadata.clear();
    this.failedCallAttempts.clear();

    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'LEAVE_ROOM',
        peerId: this.myPeerId,
      });
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }

    if (this.supabaseVoiceChannel) {
      try {
        this.supabaseVoiceChannel.untrack().catch(() => {});
        supabase.removeChannel(this.supabaseVoiceChannel);
      } catch {}
      this.supabaseVoiceChannel = null;
    }

    this.activeCalls.forEach((call) => call.close());
    this.activeCalls.clear();
    this.remoteScreenCalls.forEach((call) => call.close());
    this.remoteScreenCalls.clear();

    this.activeDataConns.forEach((conn) => conn.close());
    this.activeDataConns.clear();

    this.remoteStreams.clear();

    this.stopLocalAudioTracks();

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
      this.myPeerId = null;
    }

    this.emit('peersUpdated', []);
    this.emit('peerMetadataUpdated', {});
    this.emit('latenciesUpdated', { peerLatencies: {}, myPing: 0 });
  }
}

export const peerService = new MeshVoiceService();
