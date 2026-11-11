import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { peerService } from '../services/peerService';
import { sounds } from '../utils/audio';

const VAD_RMS_THRESHOLD = 3.2;
const VAD_HANGOVER_MS = 260;

function measureSpeechLevel(analyser, dataArray) {
  analyser.getByteTimeDomainData(dataArray);
  let sumSq = 0;
  for (let i = 0; i < dataArray.length; i++) {
    const centered = dataArray[i] - 128;
    sumSq += centered * centered;
  }
  return Math.sqrt(sumSq / dataArray.length);
}

export const useVoiceWebRTC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [myPeerId, setMyPeerId] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [activeScreenShare, setActiveScreenShare] = useState(null);
  
  // Array of remote connected peers: [{ peerId, stream, isSpeaking }]
  const [remotePeers, setRemotePeers] = useState([]);
  
  // Remote peer profile metadata: { [peerId]: { userId, name, userName, avatar } }
  const [peerMetadata, setPeerMetadata] = useState({});
  
  // Real-Time WebRTC Latencies (RTT in ms)
  const [peerLatencies, setPeerLatencies] = useState({});
  const [myPing, setMyPing] = useState(24);
  
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

  // Clean up local VAD
  const cleanupLocalVAD = useCallback(() => {
    if (localVadIntervalRef.current) {
      clearInterval(localVadIntervalRef.current);
      localVadIntervalRef.current = null;
    }
    if (localAudioContextRef.current) {
      localAudioContextRef.current.close().catch(() => {});
      localAudioContextRef.current = null;
    }
    localAnalyserRef.current = null;
    localSpeakingRef.current = false;
    setIsSpeaking(false);
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
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.45;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      localAudioContextRef.current = audioCtx;
      localAnalyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.fftSize);

      const checkVolume = () => {
        if (!localAnalyserRef.current) return;

        // Pause local visual VAD analysis while window is hidden/minimized behind a game
        if (typeof document !== 'undefined' && document.hidden) {
          if (localSpeakingRef.current) {
            localSpeakingRef.current = false;
            setIsSpeaking(false);
          }
          return;
        }

        let speakingNow = false;
        if (!isMutedRef.current) {
          const rms = measureSpeechLevel(localAnalyserRef.current, dataArray);
          const now = Date.now();
          if (rms > VAD_RMS_THRESHOLD) {
            localLastSpokeRef.current = now;
            speakingNow = true;
          } else if (now - localLastSpokeRef.current < VAD_HANGOVER_MS) {
            speakingNow = true;
          }
        }

        if (localSpeakingRef.current !== speakingNow) {
          localSpeakingRef.current = speakingNow;
          setIsSpeaking(speakingNow);
        }
      };

      checkVolume();
      localVadIntervalRef.current = setInterval(checkVolume, 90);
    } catch (err) {
      console.warn('Could not setup local audio activity detector:', err);
    }
  }, [cleanupLocalVAD]);

  // Connect to voice mesh
  const connectVoice = useCallback(async (customPeerId = null, userName = 'Sen (You)', userMeta = null) => {
    setAudioError(null);
    try {
      sounds.playJoin();

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
      } catch {}
    });
    remoteAnalysersRef.current.clear();
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
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.45;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      remoteAnalysersRef.current.set(peerId, {
        stream,
        source,
        analyser,
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
    sounds.playLeave();
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

    // Directly control the microphone track's enabled state
    peerService.setMicrophoneEnabled(!nextMuted);

    if (nextMuted) {
      sounds.playMute();
      setIsSpeaking(false);
    } else {
      sounds.playUnmute();
      if (isDeafened) {
        setIsDeafened(false);
      }
    }
  }, [isConnected, isMuted, isDeafened]);

  // Set microphone muted state explicitly (used by Push-to-Talk)
  const setMuted = useCallback((muted, playAudioFeedback = false) => {
    setIsMuted(muted);
    peerService.setMicrophoneEnabled(!muted);
    if (muted) {
      setIsSpeaking(false);
      if (playAudioFeedback) sounds.playMute();
    } else {
      if (isDeafened) setIsDeafened(false);
      if (playAudioFeedback) sounds.playUnmute();
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
      peerService.setMicrophoneEnabled(false);
      setIsSpeaking(false);
      sounds.playDeafen();
    } else {
      // Undeafen restores the microphone
      setIsMuted(false);
      peerService.setMicrophoneEnabled(true);
      sounds.playUndeafen();
    }
  }, [isConnected, isDeafened]);

  // Switch active voice room for room isolation
  const switchVoiceRoom = useCallback((roomName) => {
    cleanupRemoteVAD();
    peerService.setVoiceRoom(roomName);
    setRemotePeers([]);
    setPeerMetadata({});
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

  // Listen to incoming remote streams, remote speaking VAD, and peer leaves
  useEffect(() => {
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
        sounds.playJoin();
        return [...prev, { peerId, stream, isSpeaking: false }];
      });
    };

    const handlePeerLeft = (peerId) => {
      sounds.playLeave();
      const analyserEntry = remoteAnalysersRef.current.get(peerId);
      if (analyserEntry) {
        try {
          analyserEntry.source?.disconnect();
          analyserEntry.analyser?.disconnect();
        } catch {}
        remoteAnalysersRef.current.delete(peerId);
      }
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

    peerService.on('stream', handleStream);
    peerService.on('peerLeft', handlePeerLeft);
    peerService.on('peerMetadataUpdated', handlePeerMetadataUpdated);
    peerService.on('localStreamChanged', handleLocalStreamChanged);

    // Poll remote peer audio analysers for real-time Voice Activity Detection (green speaking ring)
    const remoteVadInterval = setInterval(() => {
      if (remoteAnalysersRef.current.size === 0) return;

      // Pause remote visual VAD polling while window is minimized/hidden behind fullscreen games
      if (typeof document !== 'undefined' && document.hidden) {
        let resetAny = false;
        const resetUpdates = {};
        remoteAnalysersRef.current.forEach((entry, peerId) => {
          if (entry?.isSpeaking) {
            entry.isSpeaking = false;
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
        return;
      }

      const now = Date.now();
      let changed = false;
      const speakingUpdates = {};

      remoteAnalysersRef.current.forEach((entry, peerId) => {
        if (!entry?.analyser || !entry.stream?.active) return;
        const rms = measureSpeechLevel(entry.analyser, entry.dataArray);
        let speakingNow = false;
        if (rms > VAD_RMS_THRESHOLD) {
          entry.lastSpokeAt = now;
          speakingNow = true;
        } else if (now - entry.lastSpokeAt < VAD_HANGOVER_MS) {
          speakingNow = true;
        }
        if (entry.isSpeaking !== speakingNow) {
          entry.isSpeaking = speakingNow;
          changed = true;
        }
        speakingUpdates[peerId] = entry.isSpeaking;
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
    }, 85);

    const handleScreenShareStarted = (info) => {
      setActiveScreenShare(info);
      if (!info.isLocal) {
        sounds.playJoin();
        toast.info(`${info.userName} ekranını paylaşıyor`, {
          icon: '🖥️',
        });
      }
    };

    const handleScreenShareStopped = ({ peerId }) => {
      setActiveScreenShare((prev) => {
        if (prev?.peerId === peerId) {
          sounds.playLeave();
          toast.info('Ekran paylaşımı sona erdi');
          return null;
        }
        return prev;
      });
      if (peerId === myPeerIdRef.current) {
        setIsScreenSharing(false);
      }
    };

    const handleLatencies = (data) => {
      if (data?.peerLatencies) {
        setPeerLatencies(data.peerLatencies);
      }
      if (typeof data?.myPing === 'number') {
        setMyPing(data.myPing);
      }
    };

    peerService.on('screenShareStarted', handleScreenShareStarted);
    peerService.on('screenShareStopped', handleScreenShareStopped);
    peerService.on('latenciesUpdated', handleLatencies);

    return () => {
      clearInterval(remoteVadInterval);
      peerService.off('stream', handleStream);
      peerService.off('peerLeft', handlePeerLeft);
      peerService.off('peerMetadataUpdated', handlePeerMetadataUpdated);
      peerService.off('localStreamChanged', handleLocalStreamChanged);
      peerService.off('screenShareStarted', handleScreenShareStarted);
      peerService.off('screenShareStopped', handleScreenShareStopped);
      peerService.off('latenciesUpdated', handleLatencies);
    };
  }, [attachRemoteAnalyser, setupLocalVAD]);

  // Screen Sharing Actions
  const startScreenShare = useCallback(async () => {
    try {
      const stream = await peerService.startScreenShare();
      if (stream) {
        setIsScreenSharing(true);
        setActiveScreenShare({
          isLocal: true,
          peerId: myPeerId,
          userName: 'Sen (You)',
          stream,
        });
        sounds.playJoin();
        toast.success('Ekran Paylaşımı Başlatıldı', {
          description: 'Ekranınız odadaki diğer kullanıcılara canlı yayınlanıyor.',
        });
      }
    } catch (err) {
      toast.error('Ekran Paylaşılamadı', {
        description: err.message || 'Ekran yakalama sırasında bir hata oluştu.',
      });
    }
  }, [myPeerId]);

  const stopScreenShare = useCallback(() => {
    peerService.stopScreenShare();
    setIsScreenSharing(false);
    setActiveScreenShare((prev) => (prev?.isLocal ? null : prev));
    sounds.playLeave();
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
    myPeerId,
    remotePeers, // Array of { peerId, stream, isSpeaking }
    peerMetadata,
    peerLatencies,
    myPing,
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
