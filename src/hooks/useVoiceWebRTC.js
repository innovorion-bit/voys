import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { peerService } from '../services/peerService';
import { isTauriEnvironment } from '../utils/windowManager';

const VAD_RMS_THRESHOLD = 1.0;
const VAD_PEAK_DEV_THRESHOLD = 3;
const VAD_HANGOVER_MS = 400;

function measureSpeechLevel(analyser, dataArray, isRemote = false) {
  analyser.getByteTimeDomainData(dataArray);
  let sumSq = 0;
  let maxDev = 0;
  const len = dataArray.length;
  for (let i = 0; i < len; i++) {
    const centered = Math.abs(dataArray[i] - 128);
    sumSq += centered * centered;
    if (centered > maxDev) maxDev = centered;
  }
  const rms = Math.sqrt(sumSq / len);
  const rmsThreshold = isRemote ? 0.6 : VAD_RMS_THRESHOLD;
  const peakThreshold = isRemote ? 2 : VAD_PEAK_DEV_THRESHOLD;
  return { rms, maxDev, isSpeaking: rms > rmsThreshold || maxDev >= peakThreshold };
}

export const useVoiceWebRTC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [myPeerId, setMyPeerId] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [activeScreenShare, setActiveScreenShare] = useState(null);
  const [availableScreenShares, setAvailableScreenShares] = useState([]);
  
  // Array of remote connected peers: [{ peerId, stream, isSpeaking }]
  const [remotePeers, setRemotePeers] = useState([]);
  
  // Remote peer profile metadata: { [peerId]: { userId, name, userName, avatar } }
  const [peerMetadata, setPeerMetadata] = useState({});

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioError, setAudioError] = useState(null);
  const [audioVolume, setAudioVolume] = useState(1);

  const isMutedRef = useRef(false);
  useEffect(() => {
    isMutedRef.current = isMuted;
    if (isMuted) setIsSpeaking(false);
  }, [isMuted]);

  const localAudioContextRef = useRef(null);
  const localAnalyserRef = useRef(null);
  const localVadIntervalRef = useRef(null);
  const localLastSpokeRef = useRef(0);
  const localSpeakingRef = useRef(false);

  const remoteAudioContextRef = useRef(null);
  const remoteAnalysersRef = useRef(new Map());
  const remoteSpeakingSignalsRef = useRef(new Map()); // peerId -> { isSpeaking, lastUpdated }

  // Clean up local VAD
  const cleanupLocalVAD = useCallback(() => {
    if (localVadIntervalRef.current) {
      localVadIntervalRef.current();
      localVadIntervalRef.current = null;
    }
    if (localAudioContextRef.current) {
      localAudioContextRef.current.close().catch(() => {});
      localAudioContextRef.current = null;
    }
    localAnalyserRef.current = null;
    localSpeakingRef.current = false;
    setIsSpeaking(false);
    peerService.broadcastSpeaking(false);
  }, []);

  // Setup Voice Activity Detection (VAD) for local microphone
  const setupLocalVAD = useCallback((stream) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx || !stream || stream.getAudioTracks().length === 0) return;

      cleanupLocalVAD();

      const audioCtx = new AudioCtx();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.45;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      localAudioContextRef.current = audioCtx;
      localAnalyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.fftSize);

      let disposed = false;
      let timerId = null;

      const scheduleNext = () => {
        if (disposed) return;
        if (typeof document !== 'undefined' && document.hidden && !isTauriEnvironment()) return;
        const delay = typeof document !== 'undefined' && !document.hasFocus() ? 180 : 90;
        timerId = setTimeout(tick, delay);
      };

      const checkVolume = () => {
        if (!localAnalyserRef.current) return;

        if (typeof document !== 'undefined' && document.hidden && !isTauriEnvironment()) {
          if (localSpeakingRef.current) {
            localSpeakingRef.current = false;
            setIsSpeaking(false);
          }
          return;
        }

        if (localAudioContextRef.current && localAudioContextRef.current.state === 'suspended') {
          localAudioContextRef.current.resume().catch(() => {});
        }

        let speakingNow = false;
        if (!isMutedRef.current) {
          if (peerService.inputMode === 'ptt') {
            speakingNow = Boolean(peerService.isPttActive);
          } else {
            const level = measureSpeechLevel(localAnalyserRef.current, dataArray, false);
            const now = Date.now();
            if (level.isSpeaking) {
              localLastSpokeRef.current = now;
              speakingNow = true;
            } else if (now - localLastSpokeRef.current < VAD_HANGOVER_MS) {
              speakingNow = true;
            }
          }
        }

        if (localSpeakingRef.current !== speakingNow) {
          localSpeakingRef.current = speakingNow;
          setIsSpeaking(speakingNow);
          peerService.broadcastSpeaking(speakingNow);
        }
      };

      const tick = () => {
        checkVolume();
        scheduleNext();
      };

      const handleVisibility = () => {
        if (disposed) return;
        if (isTauriEnvironment()) {
          // Never suspend voice detection on desktop when occluded by fullscreen games
          return;
        }
        if (timerId) {
          clearTimeout(timerId);
          timerId = null;
        }
        if (document.hidden) {
          if (localSpeakingRef.current) {
            localSpeakingRef.current = false;
            setIsSpeaking(false);
          }
        } else {
          tick();
        }
      };

      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', handleVisibility);
      }

      tick();
      localVadIntervalRef.current = () => {
        disposed = true;
        if (timerId) clearTimeout(timerId);
        if (typeof document !== 'undefined') {
          document.removeEventListener('visibilitychange', handleVisibility);
        }
      };
    } catch (err) {
      console.warn('Could not setup local audio activity detector:', err);
    }
  }, [cleanupLocalVAD]);

  // Connect to voice mesh
  const connectVoice = useCallback(async (customPeerId = null, userName = 'Sen (You)', userMeta = null) => {
    setAudioError(null);
    try {
      // 1. Get user microphone access via navigator.mediaDevices.getUserMedia
      let stream = null;
      try {
        stream = await peerService.getLocalAudioStream();
        setupLocalVAD(stream);
      } catch (micErr) {
        console.warn('Microphone permission delayed or denied:', micErr);
        if (micErr.name === 'NotAllowedError' || micErr.name === 'PermissionDeniedError') {
          toast.error('Mikrofon İzni Reddedildi', {
            description: 'Sesli sohbete katılabilmek için tarayıcınızın mikrofon iznini açın.',
          });
        } else {
          toast.warning('Mikrofon Algılanamadı', {
            description: 'Sistemde bağlı bir mikrofon cihazı bulunamadı.',
          });
        }
        setAudioError('Mikrofon izni bekleniyor (Yine de dinleyebilirsiniz)');
      }

      // 2. Initialize PeerJS mesh network
      const id = await peerService.init(customPeerId, userName, userMeta);
      setMyPeerId(id);
      setIsConnected(true);
      setIsMuted(false);
      setIsDeafened(false);

      return id;
    } catch (err) {
      console.error('Failed to connect voice service:', err);
      toast.error('Ses Bağlantı Hatası', {
        description: err.message || 'PeerJS sinyalleşme sunucusuna bağlanılamadı.',
      });
      setAudioError(err.message || 'Ses bağlantısı kurulamadı');
      setIsConnected(false);
    }
  }, [setupLocalVAD]);

  const cleanupRemoteVAD = useCallback(() => {
    remoteAnalysersRef.current.forEach((entry) => {
      try {
        entry.source?.disconnect();
        entry.analyser?.disconnect();
        entry.silenceGain?.disconnect();
      } catch {}
    });
    remoteAnalysersRef.current.clear();
    remoteSpeakingSignalsRef.current.clear();
    if (remoteAudioContextRef.current) {
      remoteAudioContextRef.current.close().catch(() => {});
      remoteAudioContextRef.current = null;
    }
  }, []);

  const attachRemoteAnalyser = useCallback((peerId, stream) => {
    if (!peerId || !stream || stream.getAudioTracks().length === 0) return;
    try {
      const existing = remoteAnalysersRef.current.get(peerId);
      if (existing && existing.stream === stream) return;
      if (existing) {
        try {
          existing.source?.disconnect();
          existing.analyser?.disconnect();
          existing.silenceGain?.disconnect();
        } catch {}
      }

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      if (!remoteAudioContextRef.current || remoteAudioContextRef.current.state === 'closed') {
        remoteAudioContextRef.current = new AudioCtx();
      }
      const ctx = remoteAudioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.45;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      // Web Audio zero-gain node connected to ctx.destination forces Chromium to pull audio frames from WebRTC
      const silenceGain = ctx.createGain();
      silenceGain.gain.value = 0;
      analyser.connect(silenceGain);
      silenceGain.connect(ctx.destination);

      remoteAnalysersRef.current.set(peerId, {
        stream,
        source,
        analyser,
        silenceGain,
        dataArray: new Uint8Array(analyser.fftSize),
        lastSpokeAt: 0,
        isSpeaking: false,
      });
    } catch (err) {
      console.warn(`Remote VAD attach warning for ${peerId}:`, err);
    }
  }, []);

  // Disconnect from voice mesh
  const disconnectVoice = useCallback(() => {
    cleanupLocalVAD();
    cleanupRemoteVAD();
    peerService.disconnect();
    setIsConnected(false);
    setRemotePeers([]);
    setPeerMetadata({});
    setIsSpeaking(false);
  }, [cleanupLocalVAD, cleanupRemoteVAD]);

  // Toggle Microphone Mute: controls stream audioTrack.enabled (true/false)
  const toggleMute = useCallback(() => {
    if (!isConnected) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    // Directly control the microphone track's enabled state and broadcast to peers
    peerService.setMicrophoneEnabled(!nextMuted, isDeafened);

    if (nextMuted) {
      setIsSpeaking(false);
    } else {
      if (isDeafened) {
        setIsDeafened(false);
      }
    }
  }, [isConnected, isMuted, isDeafened]);

  // Set microphone muted state explicitly (used by Push-to-Talk)
  const setMuted = useCallback((muted) => {
    setIsMuted(muted);
    peerService.setMicrophoneEnabled(!muted, isDeafened);
    if (muted) {
      setIsSpeaking(false);
    } else {
      if (isDeafened) setIsDeafened(false);
    }
  }, [isDeafened]);

  // Toggle Deafen: dynamically controls remote audio volume and mutes local mic
  const toggleDeafen = useCallback(() => {
    if (!isConnected) return;
    const nextDeafened = !isDeafened;
    setIsDeafened(nextDeafened);

    if (nextDeafened) {
      // Deafen automatically mutes the microphone
      setIsMuted(true);
      peerService.setMicrophoneEnabled(false, true);
      setIsSpeaking(false);
    } else {
      // Undeafen restores the microphone
      setIsMuted(false);
      peerService.setMicrophoneEnabled(true, false);
    }
  }, [isConnected, isDeafened]);

  // Switch active voice room for room isolation
  const switchVoiceRoom = useCallback((roomName) => {
    cleanupRemoteVAD();
    peerService.setVoiceRoom(roomName);
    setRemotePeers([]);
    setPeerMetadata({});
    setAvailableScreenShares([]);
    setActiveScreenShare(null);
  }, [cleanupRemoteVAD]);

  // Call another peer directly
  const callPeer = useCallback(async (targetPeerId) => {
    try {
      await peerService.callPeer(targetPeerId);
    } catch (err) {
      console.error('Call peer failed:', err);
    }
  }, []);

  const myPeerIdRef = useRef(myPeerId);
  useEffect(() => {
    myPeerIdRef.current = myPeerId;
  }, [myPeerId]);

  // Clean up audio contexts on hook unmount
  useEffect(() => {
    return () => {
      cleanupLocalVAD();
      cleanupRemoteVAD();
    };
  }, [cleanupLocalVAD, cleanupRemoteVAD]);

  // Resume AudioContexts automatically on user gesture (bypasses Chromium autoplay lock)
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const resumeAudioContexts = () => {
      if (localAudioContextRef.current && localAudioContextRef.current.state === 'suspended') {
        localAudioContextRef.current.resume().catch(() => {});
      }
      if (remoteAudioContextRef.current && remoteAudioContextRef.current.state === 'suspended') {
        remoteAudioContextRef.current.resume().catch(() => {});
      }
    };
    window.addEventListener('pointerdown', resumeAudioContexts);
    window.addEventListener('keydown', resumeAudioContexts);
    window.addEventListener('click', resumeAudioContexts);
    return () => {
      window.removeEventListener('pointerdown', resumeAudioContexts);
      window.removeEventListener('keydown', resumeAudioContexts);
      window.removeEventListener('click', resumeAudioContexts);
    };
  }, []);

  // Listen to incoming remote streams, remote speaking VAD, and peer leaves
  useEffect(() => {
    // If peerService already has streams established, attach analysers immediately
    if (peerService.remoteStreams && peerService.remoteStreams.size > 0) {
      peerService.remoteStreams.forEach((stream, pId) => {
        attachRemoteAnalyser(pId, stream);
        setRemotePeers((prev) => {
          if (prev.some((p) => p.peerId === pId)) return prev;
          return [...prev, { peerId: pId, stream, isSpeaking: false }];
        });
      });
    }

    const handleStream = ({ peerId, stream }) => {
      setPeerMetadata(peerService.getAllPeerMetadata());
      attachRemoteAnalyser(peerId, stream);
      setRemotePeers((prev) => {
        const existingIdx = prev.findIndex((p) => p.peerId === peerId);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = { ...updated[existingIdx], stream };
          return updated;
        }
        return [...prev, { peerId, stream, isSpeaking: false }];
      });
    };

    const handlePeerLeft = (peerId) => {
      const analyserEntry = remoteAnalysersRef.current.get(peerId);
      if (analyserEntry) {
        try {
          analyserEntry.source?.disconnect();
          analyserEntry.analyser?.disconnect();
          analyserEntry.silenceGain?.disconnect();
        } catch {}
        remoteAnalysersRef.current.delete(peerId);
      }
      remoteSpeakingSignalsRef.current.delete(peerId);
      setRemotePeers((prev) => prev.filter((p) => p.peerId !== peerId));
      setPeerMetadata(peerService.getAllPeerMetadata());
    };

    const handlePeerMetadataUpdated = (metaMap) => {
      setPeerMetadata(metaMap || {});
    };

    const handleLocalStreamChanged = (newStream) => {
      if (newStream) {
        setupLocalVAD(newStream);
      }
    };

    // Ultra-fast data channel / broadcast speaking update from remote peer
    const handlePeerSpeakingUpdate = ({ peerId, userId, isSpeaking, inputMode: remoteMode }) => {
      const now = Date.now();
      const boolSpeaking = Boolean(isSpeaking);
      if (peerId) {
        remoteSpeakingSignalsRef.current.set(peerId, {
          isSpeaking: boolSpeaking,
          lastUpdated: now,
        });
        peerService.setPeerMetadata(peerId, {
          ...(remoteMode ? { inputMode: remoteMode } : {}),
          ...(boolSpeaking ? { isMuted: false } : {}),
        });
      }
      const analyserEntry = remoteAnalysersRef.current.get(peerId);
      if (analyserEntry) {
        if (boolSpeaking) {
          analyserEntry.lastSpokeAt = now;
        }
        analyserEntry.isSpeaking = boolSpeaking;
      }
      setRemotePeers((prev) => {
        let matched = false;
        const next = prev.map((p) => {
          if (p.peerId === peerId || (userId && p.userId === userId)) {
            matched = true;
            return {
              ...p,
              ...(remoteMode ? { inputMode: remoteMode } : {}),
              ...(p.isSpeaking !== boolSpeaking ? { isSpeaking: boolSpeaking } : {}),
            };
          }
          return p;
        });
        if (!matched && peerId) {
          return [...next, { peerId, userId, isSpeaking: boolSpeaking, inputMode: remoteMode || 'voice', stream: null }];
        }
        return next;
      });
    };

    peerService.on('stream', handleStream);
    peerService.on('peerLeft', handlePeerLeft);
    peerService.on('peerMetadataUpdated', handlePeerMetadataUpdated);
    peerService.on('localStreamChanged', handleLocalStreamChanged);
    peerService.on('peerSpeakingUpdate', handlePeerSpeakingUpdate);

    // Poll remote peer audio analysers with adaptive intervals:
    // paused completely when document.hidden, 320ms when unfocused behind a game, 140ms when focused.
    let remoteVadDisposed = false;
    let remoteVadTimer = null;

    const resetRemoteSpeaking = () => {
      let resetAny = false;
      const resetUpdates = {};
      remoteAnalysersRef.current.forEach((entry, peerId) => {
        if (entry?.isSpeaking) {
          entry.isSpeaking = false;
          resetUpdates[peerId] = false;
          resetAny = true;
        }
      });
      remoteSpeakingSignalsRef.current.forEach((signal, peerId) => {
        if (signal?.isSpeaking) {
          signal.isSpeaking = false;
          resetUpdates[peerId] = false;
          resetAny = true;
        }
      });
      if (resetAny) {
        setRemotePeers((prev) =>
          prev.map((p) =>
            resetUpdates[p.peerId] !== undefined && p.isSpeaking
              ? { ...p, isSpeaking: false }
              : p
          )
        );
      }
    };

    const runRemoteVadTick = () => {
      if (remoteVadDisposed) return;

      if (remoteAudioContextRef.current && remoteAudioContextRef.current.state === 'suspended') {
        remoteAudioContextRef.current.resume().catch(() => {});
      }

      if (typeof document !== 'undefined' && document.hidden && !isTauriEnvironment()) {
        resetRemoteSpeaking();
        return;
      }

      if (remoteAnalysersRef.current.size > 0 || remoteSpeakingSignalsRef.current.size > 0) {
        const now = Date.now();
        let changed = false;
        const speakingUpdates = {};

        remoteAnalysersRef.current.forEach((entry, peerId) => {
          const audioTracks = entry.stream?.getAudioTracks();
          const hasLiveTrack = audioTracks && audioTracks.some((t) => t.readyState === 'live');
          if (!entry?.analyser || !hasLiveTrack) return;

          const level = measureSpeechLevel(entry.analyser, entry.dataArray, true /* isRemote */);
          const signal = remoteSpeakingSignalsRef.current.get(peerId);
          const isSignaledSpeaking = signal?.isSpeaking && (now - signal.lastUpdated < 1500);

          let speakingNow = false;
          if (level.isSpeaking || isSignaledSpeaking) {
            entry.lastSpokeAt = now;
            speakingNow = true;
            peerService.setPeerMetadata(peerId, { isMuted: false });
          } else if (now - entry.lastSpokeAt < VAD_HANGOVER_MS) {
            speakingNow = true;
          }
          if (entry.isSpeaking !== speakingNow) {
            entry.isSpeaking = speakingNow;
            changed = true;
          }
          speakingUpdates[peerId] = entry.isSpeaking;
        });

        // Also evaluate any signaled peers who might not have an analyser track yet
        remoteSpeakingSignalsRef.current.forEach((signal, peerId) => {
          if (speakingUpdates[peerId] !== undefined) return;
          const isSignaledSpeaking = signal.isSpeaking && (now - signal.lastUpdated < 1500);
          if (isSignaledSpeaking) {
            speakingUpdates[peerId] = true;
            changed = true;
          }
        });

        if (changed) {
          setRemotePeers((prev) =>
            prev.map((p) =>
              speakingUpdates[p.peerId] !== undefined && p.isSpeaking !== speakingUpdates[p.peerId]
                ? { ...p, isSpeaking: speakingUpdates[p.peerId] }
                : p
            )
          );
        }
      }

      const delay = typeof document !== 'undefined' && !document.hasFocus() ? 180 : 90;
      remoteVadTimer = setTimeout(runRemoteVadTick, delay);
    };

    const handleRemoteVadVisibility = () => {
      if (remoteVadDisposed) return;
      if (isTauriEnvironment()) return;
      if (remoteVadTimer) {
        clearTimeout(remoteVadTimer);
        remoteVadTimer = null;
      }
      if (document.hidden) {
        resetRemoteSpeaking();
      } else {
        runRemoteVadTick();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleRemoteVadVisibility);
    }
    remoteVadTimer = setTimeout(runRemoteVadTick, 140);

    const handleScreenSharesUpdated = (shares) => {
      setAvailableScreenShares(shares || []);
    };

    const handleActiveScreenShareChanged = (active) => {
      setActiveScreenShare(active);
    };

    const handleScreenShareStarted = (info) => {
      setActiveScreenShare(info);
      if (!info.isLocal) {
        toast.info(`${info.userName} ekranını paylaşıyor`, {
          icon: '🖥️',
        });
      }
    };

    const handleScreenShareStopped = ({ peerId }) => {
      setActiveScreenShare((prev) => {
        if (prev?.peerId === peerId) {
          const remaining = peerService.getAvailableScreenShares();
          if (remaining.length > 0) {
            return remaining[0];
          }
          toast.info('Ekran paylaşımı sona erdi');
          return null;
        }
        return prev;
      });
      if (peerId === myPeerIdRef.current) {
        setIsScreenSharing(false);
      }
    };

    peerService.on('screenSharesUpdated', handleScreenSharesUpdated);
    peerService.on('activeScreenShareChanged', handleActiveScreenShareChanged);
    peerService.on('screenShareStarted', handleScreenShareStarted);
    peerService.on('screenShareStopped', handleScreenShareStopped);

    return () => {
      remoteVadDisposed = true;
      if (remoteVadTimer) clearTimeout(remoteVadTimer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleRemoteVadVisibility);
      }
      peerService.off('stream', handleStream);
      peerService.off('peerLeft', handlePeerLeft);
      peerService.off('peerMetadataUpdated', handlePeerMetadataUpdated);
      peerService.off('localStreamChanged', handleLocalStreamChanged);
      peerService.off('peerSpeakingUpdate', handlePeerSpeakingUpdate);
      peerService.off('screenSharesUpdated', handleScreenSharesUpdated);
      peerService.off('activeScreenShareChanged', handleActiveScreenShareChanged);
      peerService.off('screenShareStarted', handleScreenShareStarted);
      peerService.off('screenShareStopped', handleScreenShareStopped);
    };
  }, [attachRemoteAnalyser, setupLocalVAD]);

  // Screen Sharing Actions
  const startScreenShare = useCallback(async (options = null) => {
    try {
      const stream = await peerService.startScreenShare(options);
      if (stream) {
        setIsScreenSharing(true);
        const qualityLabel =
          options?.label ||
          (options?.resolution
            ? `${options.resolution === 'source' ? 'Kaynak' : options.resolution} · ${options.fps || 30} FPS`
            : '1080p · 30 FPS');
        const localShare = {
          isLocal: true,
          peerId: myPeerId,
          userName: 'Sen (You)',
          qualityLabel,
          stream,
        };
        setActiveScreenShare(localShare);
        toast.success('Ekran Paylaşımı Başlatıldı', {
          description: `${qualityLabel} kalitesinde canlı yayınlanıyor.`,
        });
        return stream;
      }
      return null;
    } catch (err) {
      if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
        toast.error('Ekran Paylaşılamadı', {
          description: err.message || 'Ekran yakalama sırasında bir hata oluştu.',
        });
      }
      return null;
    }
  }, [myPeerId]);

  const selectScreenShare = useCallback((peerId) => {
    peerService.selectScreenShare(peerId);
    if (!peerId) {
      setActiveScreenShare(null);
    } else {
      const target = peerService.availableScreenShares.get(peerId);
      if (target) {
        setActiveScreenShare(target);
      }
    }
  }, []);

  const stopScreenShare = useCallback(() => {
    peerService.stopScreenShare();
    setIsScreenSharing(false);
    toast.info('Ekran Paylaşımı Sonlandırıldı');
  }, []);

  const toggleScreenShare = useCallback(() => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      startScreenShare();
    }
  }, [isScreenSharing, startScreenShare, stopScreenShare]);

  return {
    isConnected,
    isMuted,
    isDeafened,
    isSpeaking,
    isScreenSharing,
    activeScreenShare,
    availableScreenShares,
    selectScreenShare,
    myPeerId,
    remotePeers, // Array of { peerId, stream, isSpeaking }
    peerMetadata,
    audioError,
    audioVolume,
    setAudioVolume,
    connectVoice,
    disconnectVoice,
    toggleMute,
    setMuted,
    toggleDeafen,
    callPeer,
    switchVoiceRoom,
    startScreenShare,
    stopScreenShare,
    toggleScreenShare,
  };
};
