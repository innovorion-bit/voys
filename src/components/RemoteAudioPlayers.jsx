import React, { useCallback, useEffect, useRef } from 'react';
import {
  computeRemoteAudioGain,
  createRemoteBoostGraph,
  updateRemoteBoostGraph,
  teardownRemoteBoostGraph,
} from '../utils/remoteAudioGain';

let sharedRemoteAudioContext = null;

function getSharedRemoteAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedRemoteAudioContext || sharedRemoteAudioContext.state === 'closed') {
    sharedRemoteAudioContext = new AudioCtx();
  }
  return sharedRemoteAudioContext;
}

function applyOutputSink(audioEl, sinkId, peerId) {
  if (!audioEl || !sinkId) return;
  if (typeof audioEl.setSinkId === 'function' && audioEl.sinkId !== sinkId) {
    audioEl.setSinkId(sinkId).catch((err) => {
      console.warn(`setSinkId failed for peer ${peerId}:`, err);
    });
  }
}

/**
 * Single remote audio player element.
 * Binds the remote MediaStream to a hidden <audio autoPlay> tag,
 * dynamically controls volume (including >100% Web Audio GainNode boost + soft peak limiter),
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
  const anchorAudioRef = useRef(null);
  const boostGraphRef = useRef(null);

  const teardownBoostGraph = useCallback(() => {
    const graph = boostGraphRef.current;
    boostGraphRef.current = null;
    teardownRemoteBoostGraph({ graph, anchorEl: anchorAudioRef.current });
  }, []);

  // Bind remote MediaStream to <audio> tag on stream attach / change
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl || !stream) return undefined;

    teardownBoostGraph();

    if (audioEl.srcObject !== stream) {
      audioEl.srcObject = stream;
    }

    const playPromise = audioEl.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn(`Remote audio autoplay for ${peerId} paused:`, err);
      });
    }

    return () => {
      teardownBoostGraph();
      if (audioEl) {
        try {
          audioEl.pause();
          audioEl.srcObject = null;
        } catch {}
      }
    };
  }, [stream, peerId, teardownBoostGraph]);

  // Dynamically apply volume, mute state, and >100% Web Audio gain boost + soft limiter
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl || !stream) return undefined;

    const {
      effectiveMuted,
      totalGain,
      requiresWebAudioBoost,
      nativeAudioVolume,
    } = computeRemoteAudioGain({
      volume,
      peerVolume,
      isDeafened,
      isPeerMuted,
    });

    let cleanupResumeListener;

    const ensureResumeOnGesture = (ctx) => {
      if (cleanupResumeListener || !ctx || ctx.state !== 'suspended' || typeof window === 'undefined') {
        return;
      }
      ctx.resume().catch(() => {});
      const onGesture = () => {
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
      };
      window.addEventListener('pointerdown', onGesture, { once: true });
      window.addEventListener('keydown', onGesture, { once: true });
      cleanupResumeListener = () => {
        window.removeEventListener('pointerdown', onGesture);
        window.removeEventListener('keydown', onGesture);
      };
    };

    if (
      requiresWebAudioBoost &&
      (!boostGraphRef.current || boostGraphRef.current.rawStream !== stream)
    ) {
      const ctx = getSharedRemoteAudioContext();
      const hasAudioTrack =
        typeof stream.getAudioTracks === 'function' && stream.getAudioTracks().length > 0;

      if (ctx && hasAudioTrack) {
        try {
          teardownBoostGraph();

          const graph = createRemoteBoostGraph({
            ctx,
            stream,
            anchorEl: anchorAudioRef.current,
            initialGain: totalGain,
          });
          boostGraphRef.current = graph;

          ensureResumeOnGesture(ctx);

          if (graph && audioEl.srcObject !== graph.destination.stream) {
            audioEl.srcObject = graph.destination.stream;
            applyOutputSink(audioEl, sinkId, peerId);
            audioEl.play()?.catch((err) => {
              console.warn(`Boosted audio playback warning for peer ${peerId}:`, err);
            });
          }
        } catch (err) {
          console.warn(`Remote audio gain boost fallback for peer ${peerId}:`, err);
          teardownBoostGraph();
          if (audioEl.srcObject !== stream) {
            audioEl.srcObject = stream;
          }
        }
      }
    }

    const activeGraph = boostGraphRef.current;
    if (activeGraph && activeGraph.rawStream === stream) {
      ensureResumeOnGesture(activeGraph.ctx);

      if (audioEl.srcObject !== activeGraph.destination.stream) {
        audioEl.srcObject = activeGraph.destination.stream;
        applyOutputSink(audioEl, sinkId, peerId);
        audioEl.play()?.catch(() => {});
      }

      updateRemoteBoostGraph({
        graph: activeGraph,
        totalGain,
        anchorEl: anchorAudioRef.current,
      });

      audioEl.muted = effectiveMuted;
      audioEl.volume = effectiveMuted ? 0 : 1;
    } else {
      if (audioEl.srcObject !== stream) {
        audioEl.srcObject = stream;
      }
      audioEl.muted = effectiveMuted;
      audioEl.volume = nativeAudioVolume;
    }

    if (typeof cleanupResumeListener === 'function') {
      return cleanupResumeListener;
    }
    return undefined;
  }, [stream, peerId, isDeafened, isPeerMuted, peerVolume, volume, sinkId, teardownBoostGraph]);

  // Dynamically route audio output to the selected speaker/headphones (only when sink actually changes)
  useEffect(() => {
    applyOutputSink(audioRef.current, sinkId, peerId);
  }, [sinkId, peerId, stream]);

  return (
    <>
      <audio
        ref={audioRef}
        autoPlay
        playsInline
        className="hidden"
        data-peer-id={peerId}
      />
      <audio
        ref={anchorAudioRef}
        autoPlay
        muted
        playsInline
        className="hidden"
        aria-hidden="true"
      />
    </>
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

  // Deduplicate by peerId so the same remote audio stream can never play twice simultaneously
  const uniquePeers = [];
  const seen = new Set();
  for (const peer of remotePeers) {
    if (peer?.peerId && peer?.stream && !seen.has(peer.peerId)) {
      seen.add(peer.peerId);
      uniquePeers.push(peer);
    }
  }

  return (
    <div className="hidden pointer-events-none select-none" aria-hidden="true">
      {uniquePeers.map((peer) => {
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
