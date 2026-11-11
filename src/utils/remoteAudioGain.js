export const MAX_VOLUME_PERCENT = 200;
export const MAX_BOOST_GAIN = 4.0;

/**
 * Clamps a numeric volume percentage safely into [0, max].
 * Falls back when the value is null, empty, or non-finite, while preserving 0.
 */
export function clampVolumePercent(value, max = MAX_VOLUME_PERCENT, fallback = 100) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return Math.max(0, Math.min(max, Math.round(num)));
}

/**
 * Computes effective playback multipliers and whether Web Audio GainNode boost (> 100%)
 * is required because native HTMLMediaElement.volume is capped at 1.0.
 */
export function computeRemoteAudioGain({
  volume = 1,
  peerVolume = 100,
  isDeafened = false,
  isPeerMuted = false,
} = {}) {
  const rawMaster = Number(volume);
  const masterGain = Number.isFinite(rawMaster) ? Math.max(0, Math.min(2, rawMaster)) : 1;
  const peerPercent = clampVolumePercent(peerVolume, MAX_VOLUME_PERCENT, 100);
  const peerGain = peerPercent / 100;
  const effectiveMuted = Boolean(isDeafened || isPeerMuted || peerPercent <= 0 || masterGain <= 0);
  const totalGain = effectiveMuted ? 0 : Math.min(MAX_BOOST_GAIN, masterGain * peerGain);
  const requiresWebAudioBoost = !effectiveMuted && totalGain > 1.0001;
  const nativeAudioVolume = effectiveMuted ? 0 : Math.max(0, Math.min(1, totalGain));

  return {
    masterGain,
    peerPercent,
    peerGain,
    effectiveMuted,
    totalGain,
    requiresWebAudioBoost,
    nativeAudioVolume,
  };
}

/**
 * Builds a two-tone linear-gradient fill (normal up to 100%, amber boost above 100%)
 * for 0%..max range sliders where 100% marks the unity gain midpoint.
 */
export function getVolumeSliderFillStyle(
  percent,
  max = MAX_VOLUME_PERCENT,
  normalColor = '#10b981',
  boostColor = '#f59e0b',
  trackColor = 'rgba(255, 255, 255, 0.1)'
) {
  const safeMax = Math.max(100, Number(max) || MAX_VOLUME_PERCENT);
  const clamped = clampVolumePercent(percent, safeMax, 0);
  const fillPct = Math.max(0, Math.min(100, (clamped / safeMax) * 100));
  const unityPct = (100 / safeMax) * 100;

  if (clamped <= 100) {
    return `linear-gradient(to right, ${normalColor} 0%, ${normalColor} ${fillPct}%, ${trackColor} ${fillPct}%, ${trackColor} 100%)`;
  }

  return `linear-gradient(to right, ${normalColor} 0%, ${normalColor} ${unityPct}%, ${boostColor} ${unityPct}%, ${boostColor} ${fillPct}%, ${trackColor} ${fillPct}%, ${trackColor} 100%)`;
}

/**
 * Configures the peak limiter after GainNode so >100% boost avoids digital clipping,
 * while remaining bypassed (1:1 ratio, 0 dB threshold) at or below 100%.
 */
export function configurePeakLimiter(limiter, ctx, isBoostActive) {
  if (!limiter || !ctx) return;
  const now = ctx.currentTime || 0;
  try {
    limiter.threshold?.setValueAtTime(isBoostActive ? -1.5 : 0, now);
    limiter.knee?.setValueAtTime(isBoostActive ? 3 : 0, now);
    limiter.ratio?.setValueAtTime(isBoostActive ? 12 : 1, now);
    limiter.attack?.setValueAtTime(0.002, now);
    limiter.release?.setValueAtTime(0.08, now);
  } catch {
    if (limiter.threshold) limiter.threshold.value = isBoostActive ? -1.5 : 0;
    if (limiter.knee) limiter.knee.value = isBoostActive ? 3 : 0;
    if (limiter.ratio) limiter.ratio.value = isBoostActive ? 12 : 1;
  }
}

/**
 * Creates a Web Audio amplification chain:
 * rawStream -> GainNode -> DynamicsCompressorNode -> MediaStreamAudioDestinationNode
 * and binds rawStream to a muted anchor <audio> element so Chromium keeps decoding WebRTC frames.
 */
export function createRemoteBoostGraph({ ctx, stream, anchorEl = null, initialGain = 1 }) {
  if (!ctx || !stream) return null;

  if (anchorEl) {
    anchorEl.muted = true;
    if (anchorEl.srcObject !== stream) {
      anchorEl.srcObject = stream;
    }
    anchorEl.play?.()?.catch(() => {});
  }

  const source = ctx.createMediaStreamSource(stream);
  const gainNode = ctx.createGain();
  const limiter = ctx.createDynamicsCompressor();
  const destination = ctx.createMediaStreamDestination();

  gainNode.gain.value = initialGain;
  configurePeakLimiter(limiter, ctx, initialGain > 1.02);

  source.connect(gainNode);
  gainNode.connect(limiter);
  limiter.connect(destination);

  return {
    ctx,
    rawStream: stream,
    source,
    gainNode,
    limiter,
    destination,
  };
}

/**
 * Smoothly updates gain and limiter engagement on an active Web Audio boost graph.
 */
export function updateRemoteBoostGraph({ graph, totalGain, anchorEl = null }) {
  if (!graph) return;
  const { ctx, gainNode, limiter } = graph;
  try {
    if (typeof gainNode.gain?.setTargetAtTime === 'function') {
      gainNode.gain.setTargetAtTime(totalGain, ctx.currentTime || 0, 0.015);
    } else {
      gainNode.gain.value = totalGain;
    }
  } catch {
    gainNode.gain.value = totalGain;
  }

  configurePeakLimiter(limiter, ctx, totalGain > 1.02);

  if (anchorEl) {
    anchorEl.muted = true;
  }
}

/**
 * Disconnects all Web Audio boost nodes and releases the muted Chromium anchor element.
 */
export function teardownRemoteBoostGraph({ graph, anchorEl = null }) {
  if (graph) {
    try {
      graph.source?.disconnect();
    } catch {}
    try {
      graph.gainNode?.disconnect();
    } catch {}
    try {
      graph.limiter?.disconnect();
    } catch {}
    try {
      graph.destination?.disconnect();
    } catch {}
    try {
      graph.destination?.stream?.getTracks?.().forEach((track) => track.stop());
    } catch {}
  }

  if (anchorEl) {
    try {
      anchorEl.pause?.();
      anchorEl.srcObject = null;
    } catch {}
  }
}
