// Shared AI Noise Suppression (RNNoise 48kHz WASM) + Noise Gate + Anti-Static AudioWorklet DSP Pipeline

export const NOISE_SUPPRESSION_MODES = {
  balanced: {
    id: 'balanced',
    label: 'Dengeli (AI RNNoise)',
    shortLabel: 'AI Dengeli',
    desc: '48kHz yapay zeka gürültü azaltma — fan, klavye ve ortam seslerini temizler, konuşmayı doğal tutar',
  },
  aggressive: {
    id: 'aggressive',
    label: 'Agresif (RNNoise + Gürültü Kapısı)',
    shortLabel: 'AI Agresif',
    desc: 'AI RNNoise + otomatik gürültü kapısı — konuşmadığınız anlarda arka planı tamamen keser',
  },
};

export const DEFAULT_AI_NOISE_SUPPRESSION = true;
export const DEFAULT_NOISE_SUPPRESSION_MODE = 'balanced';
export const DEFAULT_NOISE_GATE_THRESHOLD = -48; // dB
export const MIN_NOISE_GATE_THRESHOLD = -65;
export const MAX_NOISE_GATE_THRESHOLD = -25;
export const NOISE_GATE_HYSTERESIS_DB = 6;
export const NOISE_GATE_HOLD_MS = 220;

export const STORAGE_KEYS = {
  aiNoiseSuppression: 'standupp_ai_noise_suppression',
  noiseSuppressionMode: 'standupp_noise_suppression_mode',
  noiseGateThreshold: 'standupp_noise_gate_threshold',
};

export function normalizeNoiseSuppressionMode(mode) {
  return mode === 'aggressive' ? 'aggressive' : DEFAULT_NOISE_SUPPRESSION_MODE;
}

export function clampNoiseGateThreshold(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return DEFAULT_NOISE_GATE_THRESHOLD;
  return Math.max(MIN_NOISE_GATE_THRESHOLD, Math.min(MAX_NOISE_GATE_THRESHOLD, Math.round(num)));
}

export function readStoredBool(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const val = window.localStorage?.getItem(key);
    return val !== null && val !== undefined ? val === 'true' : fallback;
  } catch {
    return fallback;
  }
}

export function readStoredNumber(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const val = window.localStorage?.getItem(key);
    if (val === null || val === undefined) return fallback;
    const num = Number(val);
    return Number.isFinite(num) ? num : fallback;
  } catch {
    return fallback;
  }
}

export function readStoredNoiseSuppressionMode(key = STORAGE_KEYS.noiseSuppressionMode) {
  if (typeof window === 'undefined') return DEFAULT_NOISE_SUPPRESSION_MODE;
  try {
    const val = window.localStorage?.getItem(key);
    return val ? normalizeNoiseSuppressionMode(val) : DEFAULT_NOISE_SUPPRESSION_MODE;
  } catch {
    return DEFAULT_NOISE_SUPPRESSION_MODE;
  }
}

/**
 * Pure planner describing which AudioNodes / AudioWorklets should be active
 * for the current voice settings.
 */
export function buildAudioDspPlan({
  aiNoiseSuppression = DEFAULT_AI_NOISE_SUPPRESSION,
  noiseSuppressionMode = DEFAULT_NOISE_SUPPRESSION_MODE,
  noiseGateThreshold = DEFAULT_NOISE_GATE_THRESHOLD,
  antiStaticFilter = true,
  inputVolume = 100,
} = {}) {
  const useAiNs = Boolean(aiNoiseSuppression);
  const mode = normalizeNoiseSuppressionMode(noiseSuppressionMode);
  const useNoiseGate = useAiNs && mode === 'aggressive';
  const useAntiStatic = Boolean(antiStaticFilter);

  const volNum = Number(inputVolume);
  const safeVolume = Math.max(0, Math.min(100, Number.isFinite(volNum) ? volNum : 100));
  const inputGain = Math.max(0, Math.min(1.5, safeVolume / 100));

  const openThreshold = clampNoiseGateThreshold(noiseGateThreshold);
  const closeThreshold = Math.max(-75, openThreshold - NOISE_GATE_HYSTERESIS_DB);

  return {
    needsDsp: useAiNs || useAntiStatic || safeVolume !== 100,
    useAiNs,
    useNoiseGate,
    useAntiStatic,
    mode,
    safeVolume,
    inputGain,
    gateOptions: {
      openThreshold,
      closeThreshold,
      holdMs: NOISE_GATE_HOLD_MS,
      maxChannels: 1,
    },
  };
}

let cachedBundlePromise = null;
let cachedRnnoiseBinaryPromise = null;
const registeredRnnoiseContexts = new WeakSet();
const registeredNoiseGateContexts = new WeakSet();

async function loadWorkletBundle() {
  if (!cachedBundlePromise) {
    cachedBundlePromise = (async () => {
      const [
        pkg,
        rnnoiseWorkletUrlMod,
        rnnoiseWasmUrlMod,
        rnnoiseSimdWasmUrlMod,
        noiseGateWorkletUrlMod,
      ] = await Promise.all([
        import('@sapphi-red/web-noise-suppressor'),
        import('@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url'),
        import('@sapphi-red/web-noise-suppressor/rnnoise.wasm?url'),
        import('@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url'),
        import('@sapphi-red/web-noise-suppressor/noiseGateWorklet.js?url'),
      ]);

      return {
        loadRnnoise: pkg.loadRnnoise,
        RnnoiseWorkletNode: pkg.RnnoiseWorkletNode,
        NoiseGateWorkletNode: pkg.NoiseGateWorkletNode,
        rnnoiseWorkletUrl: rnnoiseWorkletUrlMod.default,
        rnnoiseWasmUrl: rnnoiseWasmUrlMod.default,
        rnnoiseSimdWasmUrl: rnnoiseSimdWasmUrlMod.default,
        noiseGateWorkletUrl: noiseGateWorkletUrlMod.default,
      };
    })().catch((err) => {
      cachedBundlePromise = null;
      throw err;
    });
  }
  return cachedBundlePromise;
}

async function getRnnoiseWasmBinary(bundle) {
  if (!cachedRnnoiseBinaryPromise) {
    cachedRnnoiseBinaryPromise = bundle
      .loadRnnoise({
        url: bundle.rnnoiseWasmUrl,
        simdUrl: bundle.rnnoiseSimdWasmUrl,
      })
      .catch((err) => {
        cachedRnnoiseBinaryPromise = null;
        throw err;
      });
  }
  return cachedRnnoiseBinaryPromise;
}

/**
 * Creates a low-latency AudioContext anchored at 48kHz (required by RNNoise WASM),
 * gracefully falling back if hardware refuses explicit sampleRate constraints.
 */
export function createVoiceAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;

  try {
    return new AudioCtx({ sampleRate: 48000, latencyHint: 'interactive' });
  } catch {
    try {
      return new AudioCtx({ latencyHint: 'interactive' });
    } catch {
      return new AudioCtx();
    }
  }
}

/**
 * Connects Source -> [Highpass 85Hz] -> [RNNoise 48kHz Worklet] -> [NoiseGate Worklet]
 * -> [Lowpass 12.5kHz + Soft Compressor] -> GainNode on an existing AudioContext.
 */
export async function buildMicDspChain(ctx, sourceNode, config = {}, overrides = null) {
  const plan = buildAudioDspPlan(config);
  const createdNodes = [];
  let head = sourceNode;
  let rnnoiseNode = null;
  let noiseGateNode = null;
  let aiNsApplied = false;
  let noiseGateApplied = false;

  // 1. Cut sub-85Hz rumble, mains hum, and breath pops before neural noise suppression
  if (plan.useAntiStatic && typeof ctx.createBiquadFilter === 'function') {
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 85;
    highpass.Q.value = 0.707;
    head.connect(highpass);
    head = highpass;
    createdNodes.push(highpass);
  }

  // 2. Neural RNNoise (requires 48kHz AudioContext) + optional Noise Gate AudioWorklet
  const canUseWorklets = Boolean(ctx?.audioWorklet && typeof ctx.audioWorklet.addModule === 'function');
  if ((plan.useAiNs || plan.useNoiseGate) && canUseWorklets) {
    try {
      const bundle = overrides?.bundle || (await loadWorkletBundle());

      if (plan.useAiNs && ctx.sampleRate === 48000) {
        if (!registeredRnnoiseContexts.has(ctx)) {
          await ctx.audioWorklet.addModule(bundle.rnnoiseWorkletUrl);
          registeredRnnoiseContexts.add(ctx);
        }
        const wasmBinary = overrides?.wasmBinary || (await getRnnoiseWasmBinary(bundle));
        rnnoiseNode = new bundle.RnnoiseWorkletNode(ctx, {
          maxChannels: 1,
          // Always clone cached ArrayBuffer before transferring to AudioWorkletGlobalScope
          wasmBinary: wasmBinary.slice(0),
        });
        head.connect(rnnoiseNode);
        head = rnnoiseNode;
        createdNodes.push(rnnoiseNode);
        aiNsApplied = true;
      } else if (plan.useAiNs && ctx.sampleRate !== 48000) {
        console.warn(`[Voys] RNNoise requires 48kHz AudioContext; got ${ctx.sampleRate}Hz, using fallback DSP.`);
      }

      if (plan.useNoiseGate) {
        if (!registeredNoiseGateContexts.has(ctx)) {
          await ctx.audioWorklet.addModule(bundle.noiseGateWorkletUrl);
          registeredNoiseGateContexts.add(ctx);
        }
        noiseGateNode = new bundle.NoiseGateWorkletNode(ctx, plan.gateOptions);
        head.connect(noiseGateNode);
        head = noiseGateNode;
        createdNodes.push(noiseGateNode);
        noiseGateApplied = true;
      }
    } catch (err) {
      console.warn('[Voys] AI noise suppression AudioWorklet fallback:', err);
    }
  }

  // 3. Roll off high-frequency hiss & prevent digital clipping
  if (plan.useAntiStatic && typeof ctx.createBiquadFilter === 'function' && typeof ctx.createDynamicsCompressor === 'function') {
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 12500;
    lowpass.Q.value = 0.707;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 12;
    compressor.ratio.value = 3.5;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.12;

    head.connect(lowpass);
    lowpass.connect(compressor);
    head = compressor;
    createdNodes.push(lowpass, compressor);
  }

  // 4. Input gain control
  const gainNode = ctx.createGain();
  gainNode.gain.value = plan.inputGain;
  head.connect(gainNode);
  createdNodes.push(gainNode);

  const cleanup = () => {
    if (rnnoiseNode && typeof rnnoiseNode.destroy === 'function') {
      try {
        rnnoiseNode.destroy();
      } catch {}
    }
    createdNodes.forEach((node) => {
      try {
        node.disconnect();
      } catch {}
    });
  };

  return {
    plan,
    outputNode: gainNode,
    gainNode,
    rnnoiseNode,
    noiseGateNode,
    aiNsApplied,
    noiseGateApplied,
    sampleRate: ctx.sampleRate,
    cleanup,
  };
}
