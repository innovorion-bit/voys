import React, { useEffect, useRef } from 'react';

/**
 * Single remote audio player element.
 * Binds the remote MediaStream to a hidden <audio autoPlay> tag,
 * dynamically controls volume and mute state based on isDeafened,
 * and routes audio to the user-selected speaker output device (setSinkId).
 */
const RemoteAudioItem = ({
  peerId,
  stream,
  isDeafened,
  volume = 1,
  peerVolume = 100,
  isPeerMuted = false,
  sinkId,
}) => {
  const audioRef = useRef(null);

  // Bind remote MediaStream to <audio> tag
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl || !stream) return;

    if (audioEl.srcObject !== stream) {
      audioEl.srcObject = stream;
    }

    const playPromise = audioEl.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn(`Remote audio autoplay for ${peerId} paused:`, err);
      });
    }
  }, [stream, peerId]);

  // Dynamically control volume and muted state based on isDeafened and per-peer overrides
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    const effectiveMuted = Boolean(isDeafened || isPeerMuted || Number(peerVolume) <= 0);
    const peerMultiplier = Math.max(0, Math.min(1, Number(peerVolume) / 100));
    audioEl.muted = effectiveMuted;
    audioEl.volume = effectiveMuted ? 0 : Math.max(0, Math.min(1, volume * peerMultiplier));
  }, [isDeafened, isPeerMuted, peerVolume, volume]);

  // Dynamically route audio output to the selected speaker/headphones
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    if (sinkId && typeof audioEl.setSinkId === 'function') {
      audioEl.setSinkId(sinkId).catch((err) => {
        console.warn(`setSinkId failed for peer ${peerId}:`, err);
      });
    }
  }, [sinkId, peerId]);

  return (
    <audio
      ref={audioRef}
      autoPlay
      playsInline
      className="hidden"
      data-peer-id={peerId}
    />
  );
};

/**
 * RemoteAudioPlayers:
 * Renders hidden <audio autoPlay> tags directly within the React component
 * for each remote stream received across the P2P mesh network.
 */
export const RemoteAudioPlayers = ({ 
  remotePeers = [], 
  isDeafened = false, 
  volume = 1, 
  peerAudioMap = {},
  sinkId = '' 
}) => {
  if (!remotePeers || remotePeers.length === 0) return null;

  return (
    <div className="hidden pointer-events-none select-none" aria-hidden="true">
      {remotePeers.map((peer) => {
        const override = peerAudioMap?.[peer.peerId];
        return (
          <RemoteAudioItem
            key={peer.peerId}
            peerId={peer.peerId}
            stream={peer.stream}
            isDeafened={isDeafened}
            volume={volume}
            peerVolume={override?.volume ?? 100}
            isPeerMuted={Boolean(override?.muted)}
            sinkId={sinkId}
          />
        );
      })}
    </div>
  );
};
