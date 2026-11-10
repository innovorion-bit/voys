import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { peerService } from '../services/peerService';
import { sounds } from '../utils/audio';

export const useVoiceWebRTC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [myPeerId, setMyPeerId] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [activeScreenShare, setActiveScreenShare] = useState(null);
  
  // Array of remote connected peers: [{ peerId, stream, isSpeaking }]
  const [remotePeers, setRemotePeers] = useState([]);
  
  // Real-Time WebRTC Latencies (RTT in ms)
  const [peerLatencies, setPeerLatencies] = useState({});
  const [myPing, setMyPing] = useState(24);
  
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioError, setAudioError] = useState(null);
  const [audioVolume, setAudioVolume] = useState(1);

  const localAudioContextRef = useRef(null);
  const localAnalyserRef = useRef(null);
  const localAnimFrameRef = useRef(null);

  // Setup Voice Activity Detection (VAD) for local microphone
  const setupLocalVAD = useCallback((stream) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx || !stream) return;

      const audioCtx = new AudioCtx();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      localAudioContextRef.current = audioCtx;
      localAnalyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkVolume = () => {
        if (!localAnalyserRef.current) return;
        localAnalyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;

        // True if voice intensity > threshold and mic track is not muted
        const speakingNow = avg > 14 && !isMuted;
        setIsSpeaking(speakingNow);

        localAnimFrameRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (err) {
      console.warn('Could not setup local audio activity detector:', err);
    }
  }, [isMuted]);

  // Clean up local VAD
  const cleanupLocalVAD = useCallback(() => {
    if (localAnimFrameRef.current) {
      cancelAnimationFrame(localAnimFrameRef.current);
      localAnimFrameRef.current = null;
    }
    if (localAudioContextRef.current) {
      localAudioContextRef.current.close().catch(() => {});
      localAudioContextRef.current = null;
    }
    localAnalyserRef.current = null;
    setIsSpeaking(false);
  }, []);

  // Connect to voice mesh
  const connectVoice = useCallback(async (customPeerId = null, userName = 'Sen (You)') => {
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
      const id = await peerService.init(customPeerId, userName);
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

  // Disconnect from voice mesh
  const disconnectVoice = useCallback(() => {
    sounds.playLeave();
    cleanupLocalVAD();
    peerService.disconnect();
    setIsConnected(false);
    setRemotePeers([]);
    setIsSpeaking(false);
  }, [cleanupLocalVAD]);

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
    peerService.setVoiceRoom(roomName);
    setRemotePeers([]);
  }, []);

  // Call another peer directly
  const callPeer = useCallback(async (targetPeerId) => {
    try {
      await peerService.callPeer(targetPeerId);
    } catch (err) {
      console.error('Call peer failed:', err);
    }
  }, []);

  // Listen to incoming remote streams and peer leaves
  useEffect(() => {
    const handleStream = ({ peerId, stream }) => {
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
      setRemotePeers((prev) => prev.filter((p) => p.peerId !== peerId));
    };

    peerService.on('stream', handleStream);
    peerService.on('peerLeft', handlePeerLeft);

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
      if (peerId === myPeerId) {
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
      peerService.off('stream', handleStream);
      peerService.off('peerLeft', handlePeerLeft);
      peerService.off('screenShareStarted', handleScreenShareStarted);
      peerService.off('screenShareStopped', handleScreenShareStopped);
      peerService.off('latenciesUpdated', handleLatencies);
      cleanupLocalVAD();
    };
  }, [cleanupLocalVAD, myPeerId]);

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
