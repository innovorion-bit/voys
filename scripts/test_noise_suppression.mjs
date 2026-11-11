import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

import {
  DEFAULT_AI_NOISE_SUPPRESSION,
  DEFAULT_NOISE_GATE_THRESHOLD,
  MIN_NOISE_GATE_THRESHOLD,
  MAX_NOISE_GATE_THRESHOLD,
  normalizeNoiseSuppressionMode,
  clampNoiseGateThreshold,
  buildAudioDspPlan,
  buildMicDspChain,
} from '../src/utils/noiseSuppressionPipeline.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function createMockAudioContext(sampleRate = 48000, workletShouldFail = false) {
  const addedModules = [];
  const createdNodes = [];
  let closed = false;

  const makeConnectable = (type, extra = {}) => {
    const node = {
      type,
      connections: [],
      disconnected: false,
      connect(target) {
        this.connections.push(target);
        return target;
      },
      disconnect() {
        this.disconnected = true;
      },
      ...extra,
    };
    createdNodes.push(node);
    return node;
  };

  const ctx = {
    sampleRate,
    state: 'running',
    currentTime: 0,
    addedModules,
    createdNodes,
    get isClosed() {
      return closed;
    },
    audioWorklet: {
      async addModule(url) {
        if (workletShouldFail) throw new Error('Simulated AudioWorklet failure');
        addedModules.push(url);
      },
    },
    createBiquadFilter() {
      return makeConnectable('biquad', {
        frequency: { value: 0 },
        Q: { value: 0 },
      });
    },
    createDynamicsCompressor() {
      return makeConnectable('compressor', {
        threshold: { value: 0 },
        knee: { value: 0 },
        ratio: { value: 0 },
        attack: { value: 0 },
        release: { value: 0 },
      });
    },
    createGain() {
      return makeConnectable('gain', {
        gain: {
          value: 1,
          setTargetAtTime(v) {
            this.value = v;
          },
        },
      });
    },
    createMediaStreamSource(stream) {
      return makeConnectable('source', { stream });
    },
    createMediaStreamDestination() {
      const outTrack = {
        kind: 'audio',
        enabled: true,
        stopped: false,
        stop() {
          this.stopped = true;
        },
      };
      const stream = {
        active: true,
        id: `processed_${Math.random().toString(36).slice(2, 7)}`,
        getAudioTracks: () => [outTrack],
        getTracks: () => [outTrack],
      };
      return makeConnectable('destination', { stream });
    },
    async close() {
      closed = true;
      this.state = 'closed';
    },
  };

  return ctx;
}

function createMockRawStream(enabled = true) {
  const track = {
    kind: 'audio',
    enabled,
    stopped: false,
    constraintsHistory: [],
    async applyConstraints(c) {
      this.constraintsHistory.push(c);
    },
    stop() {
      this.stopped = true;
    },
  };
  return {
    active: true,
    id: `raw_${Math.random().toString(36).slice(2, 7)}`,
    getAudioTracks: () => [track],
    getTracks: () => [track],
    _track: track,
  };
}

function createMockBundle({ delayMs = 0 } = {}) {
  const instances = { rnnoise: [], noiseGate: [] };

  class MockRnnoiseWorkletNode {
    constructor(ctx, opts) {
      this.ctx = ctx;
      this.opts = opts;
      this.destroyed = false;
      this.disconnected = false;
      this.connections = [];
      instances.rnnoise.push(this);
    }
    connect(target) {
      this.connections.push(target);
      return target;
    }
    disconnect() {
      this.disconnected = true;
    }
    destroy() {
      this.destroyed = true;
    }
  }

  class MockNoiseGateWorkletNode {
    constructor(ctx, opts) {
      this.ctx = ctx;
      this.opts = opts;
      this.disconnected = false;
      this.connections = [];
      instances.noiseGate.push(this);
    }
    connect(target) {
      this.connections.push(target);
      return target;
    }
    disconnect() {
      this.disconnected = true;
    }
  }

  return {
    instances,
    bundle: {
      rnnoiseWorkletUrl: '/mock/rnnoiseWorklet.js',
      noiseGateWorkletUrl: '/mock/noiseGateWorklet.js',
      rnnoiseWasmUrl: '/mock/rnnoise.wasm',
      rnnoiseSimdWasmUrl: '/mock/rnnoise_simd.wasm',
      RnnoiseWorkletNode: MockRnnoiseWorkletNode,
      NoiseGateWorkletNode: MockNoiseGateWorkletNode,
      loadRnnoise: async () => {
        if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
        return new Uint8Array([0, 97, 115, 109]).buffer;
      },
    },
  };
}

async function run() {
  let passed = 0;
  const test = async (name, fn) => {
    await fn();
    passed += 1;
    console.log(`[PASS] ${name}`);
  };

  await test('1. Packaged WASM & AudioWorklet files exist and have valid headers', async () => {
    const pkgDist = path.join(rootDir, 'node_modules', '@sapphi-red', 'web-noise-suppressor', 'dist');
    const wasmRegular = fs.readFileSync(path.join(pkgDist, 'rnnoise.wasm'));
    const wasmSimd = fs.readFileSync(path.join(pkgDist, 'rnnoise_simd.wasm'));
    assert.deepEqual([...wasmRegular.subarray(0, 4)], [0x00, 0x61, 0x73, 0x6d]);
    assert.deepEqual([...wasmSimd.subarray(0, 4)], [0x00, 0x61, 0x73, 0x6d]);
    assert.ok(fs.existsSync(path.join(pkgDist, 'rnnoise', 'workletProcessor.js')));
    assert.ok(fs.existsSync(path.join(pkgDist, 'noiseGate', 'workletProcessor.js')));
  });

  await test('2. Mode normalization and Noise Gate dB threshold clamping', async () => {
    assert.equal(normalizeNoiseSuppressionMode('aggressive'), 'aggressive');
    assert.equal(normalizeNoiseSuppressionMode('balanced'), 'balanced');
    assert.equal(normalizeNoiseSuppressionMode('unknown'), 'balanced');
    assert.equal(normalizeNoiseSuppressionMode(null), 'balanced');

    assert.equal(clampNoiseGateThreshold(-100), MIN_NOISE_GATE_THRESHOLD);
    assert.equal(clampNoiseGateThreshold(0), MAX_NOISE_GATE_THRESHOLD);
    assert.equal(clampNoiseGateThreshold(-48.4), -48);
    assert.equal(clampNoiseGateThreshold('bad'), DEFAULT_NOISE_GATE_THRESHOLD);
  });

  await test('3. buildAudioDspPlan produces accurate execution plans for all modes', async () => {
    const balanced = buildAudioDspPlan({
      aiNoiseSuppression: true,
      noiseSuppressionMode: 'balanced',
      antiStaticFilter: true,
      inputVolume: 100,
    });
    assert.equal(balanced.needsDsp, true);
    assert.equal(balanced.useAiNs, true);
    assert.equal(balanced.useNoiseGate, false);
    assert.equal(balanced.useAntiStatic, true);
    assert.equal(balanced.inputGain, 1);

    const aggressive = buildAudioDspPlan({
      aiNoiseSuppression: true,
      noiseSuppressionMode: 'aggressive',
      noiseGateThreshold: -42,
      antiStaticFilter: false,
      inputVolume: 80,
    });
    assert.equal(aggressive.useAiNs, true);
    assert.equal(aggressive.useNoiseGate, true);
    assert.equal(aggressive.useAntiStatic, false);
    assert.equal(aggressive.inputGain, 0.8);
    assert.deepEqual(aggressive.gateOptions, {
      openThreshold: -42,
      closeThreshold: -48,
      holdMs: 220,
      maxChannels: 1,
    });

    const bypass = buildAudioDspPlan({
      aiNoiseSuppression: false,
      noiseSuppressionMode: 'aggressive', // gate only runs with AI NS enabled
      antiStaticFilter: false,
      inputVolume: 100,
    });
    assert.equal(bypass.needsDsp, false);
    assert.equal(bypass.useAiNs, false);
    assert.equal(bypass.useNoiseGate, false);
  });

  await test('4. buildMicDspChain orders Highpass -> RNNoise -> NoiseGate -> Lowpass -> Compressor -> Gain and clones WASM buffer', async () => {
    const ctx = createMockAudioContext(48000);
    const source = ctx.createMediaStreamSource({});
    const mock = createMockBundle();
    const sharedWasm = new Uint8Array([0, 97, 115, 109, 1, 2, 3, 4]).buffer;

    const chain = await buildMicDspChain(
      ctx,
      source,
      {
        aiNoiseSuppression: true,
        noiseSuppressionMode: 'aggressive',
        noiseGateThreshold: -45,
        antiStaticFilter: true,
        inputVolume: 90,
      },
      { bundle: mock.bundle, wasmBinary: sharedWasm }
    );

    assert.equal(chain.aiNsApplied, true);
    assert.equal(chain.noiseGateApplied, true);
    assert.equal(mock.instances.rnnoise.length, 1);
    assert.equal(mock.instances.noiseGate.length, 1);
    assert.notEqual(mock.instances.rnnoise[0].opts.wasmBinary, sharedWasm);
    assert.equal(mock.instances.rnnoise[0].opts.wasmBinary.byteLength, sharedWasm.byteLength);
    assert.equal(mock.instances.noiseGate[0].opts.openThreshold, -45);
    assert.equal(mock.instances.noiseGate[0].opts.closeThreshold, -51);

    // Verify linear signal chain wiring: source -> highpass(85) -> rnnoise -> noiseGate -> lowpass(12500) -> compressor -> gain
    const hp = source.connections[0];
    assert.equal(hp.frequency.value, 85);
    const rnn = hp.connections[0];
    assert.equal(rnn, mock.instances.rnnoise[0]);
    const gate = rnn.connections[0];
    assert.equal(gate, mock.instances.noiseGate[0]);
    const lp = gate.connections[0];
    assert.equal(lp.frequency.value, 12500);
    const comp = lp.connections[0];
    assert.equal(comp.type, 'compressor');
    const gain = comp.connections[0];
    assert.equal(gain, chain.gainNode);
    assert.equal(gain.gain.value, 0.9);

    chain.cleanup();
    assert.equal(mock.instances.rnnoise[0].destroyed, true);
    assert.equal(mock.instances.noiseGate[0].disconnected, true);
    assert.equal(gain.disconnected, true);
  });

  await test('5. buildMicDspChain skips RNNoise gracefully on non-48kHz AudioContext and handles Worklet failure', async () => {
    const origWarn = console.warn;
    console.warn = () => {};
    try {
      const ctx16k = createMockAudioContext(16000);
      const src1 = ctx16k.createMediaStreamSource({});
      const mock1 = createMockBundle();
      const chain1 = await buildMicDspChain(
        ctx16k,
        src1,
        { aiNoiseSuppression: true, noiseSuppressionMode: 'aggressive', antiStaticFilter: true },
        { bundle: mock1.bundle, wasmBinary: new ArrayBuffer(8) }
      );
      assert.equal(chain1.aiNsApplied, false);
      assert.equal(chain1.noiseGateApplied, true);
      assert.equal(mock1.instances.rnnoise.length, 0);

      const ctxBroken = createMockAudioContext(48000, true);
      const src2 = ctxBroken.createMediaStreamSource({});
      const chain2 = await buildMicDspChain(
        ctxBroken,
        src2,
        { aiNoiseSuppression: true, noiseSuppressionMode: 'balanced', antiStaticFilter: true },
        { bundle: mock1.bundle, wasmBinary: new ArrayBuffer(8) }
      );
      assert.equal(chain2.aiNsApplied, false);
      assert.ok(chain2.outputNode);
    } finally {
      console.warn = origWarn;
    }
  });

  await test('6. MeshVoiceService live settings updates, muted track preservation, and race-safe cleanup', async () => {
    const viteServer = await createServer({
      root: rootDir,
      server: { middlewareMode: true },
      appType: 'custom',
      logLevel: 'silent',
    });

    try {
      const { MeshVoiceService } = await viteServer.ssrLoadModule('/src/services/peerService.js');
      const svc = new MeshVoiceService();

      assert.equal(svc.aiNoiseSuppressionEnabled, DEFAULT_AI_NOISE_SUPPRESSION);
      assert.equal(svc.noiseSuppressionMode, 'balanced');
      assert.equal(svc.noiseGateThreshold, DEFAULT_NOISE_GATE_THRESHOLD);

      const rawStream = createMockRawStream(false); // muted mic (e.g. PTT idle)
      svc.rawLocalStream = rawStream;

      const mock = createMockBundle();
      const ctx = createMockAudioContext(48000);
      const wasmBinary = new Uint8Array([0, 97, 115, 109, 1]).buffer;

      const processed = await svc.buildProcessedLocalStream(rawStream, {
        audioContext: ctx,
        bundle: mock.bundle,
        wasmBinary,
      });

      assert.notEqual(processed, rawStream);
      // Outgoing track must preserve raw muted state (enabled === false)
      assert.equal(processed.getAudioTracks()[0].enabled, false);
      assert.equal(svc.getNoiseSuppressionStatus().aiNsApplied, true);
      assert.equal(svc.getNoiseSuppressionStatus().noiseGateApplied, false);

      svc.localStream = processed;
      let replacedTracks = [];
      svc.replaceOutgoingAudioTrack = (track) => replacedTracks.push(track);
      let emittedStreams = [];
      svc.on('localStreamChanged', (s) => emittedStreams.push(s));

      // Disable all DSP & turn antiStatic off -> should revert cleanly to rawLocalStream without applyConstraints
      await svc.applyAudioSettings({
        aiNoiseSuppression: false,
        antiStaticFilter: false,
      });
      // Since antiStatic & aiNoiseSuppression are off and volume is 100%, in Node without window -> reverts to rawStream
      assert.equal(rawStream._track.constraintsHistory.length, 0);
      assert.equal(svc.localStream, rawStream);
      assert.equal(emittedStreams.length, 1);
      assert.equal(replacedTracks[0], rawStream._track);
      assert.equal(mock.instances.rnnoise[0].destroyed, true);
      assert.equal(ctx.isClosed, true);

      // Re-test concurrent buildProcessedLocalStream race guard: older build must abort & self-clean
      const slowCtx = createMockAudioContext(48000);
      const fastCtx = createMockAudioContext(48000);
      const delayedBundle = {
        ...mock.bundle,
        RnnoiseWorkletNode: mock.bundle.RnnoiseWorkletNode,
        NoiseGateWorkletNode: mock.bundle.NoiseGateWorkletNode,
      };
      // Trigger a slow async DSP build while enabling AI NS
      svc.setAiNoiseSuppression(true);
      let resolveSlowWasm;
      const slowBundle = {
        ...delayedBundle,
        loadRnnoise: () => new Promise((res) => { resolveSlowWasm = res; }),
      };

      // Force internal async wait via custom bundle without wasmBinary override
      const pSlow = (async () => {
        // simulate awaiting bundle loader inside buildMicDspChain by passing custom ctx whose addModule pauses
        const origAdd = slowCtx.audioWorklet.addModule.bind(slowCtx.audioWorklet);
        slowCtx.audioWorklet.addModule = async (u) => {
          await new Promise((res) => { resolveSlowWasm = res; });
          return origAdd(u);
        };
        return svc.buildProcessedLocalStream(rawStream, {
          audioContext: slowCtx,
          bundle: slowBundle,
          wasmBinary,
        });
      })();

      // Wait one tick so pSlow enters addModule
      await new Promise((r) => setTimeout(r, 15));
      // Newer build arrives immediately
      const fastStream = await svc.buildProcessedLocalStream(rawStream, {
        audioContext: fastCtx,
        bundle: delayedBundle,
        wasmBinary,
      });
      svc.localStream = fastStream;

      // Now unblock slow build
      resolveSlowWasm();
      const slowResult = await pSlow;
      assert.equal(slowCtx.isClosed, true);
      assert.equal(slowResult, fastStream);

      svc.stopLocalAudioTracks();
      assert.equal(fastCtx.isClosed, true);
      assert.equal(rawStream._track.stopped, true);
    } finally {
      await viteServer.close();
    }
  });

  console.log(`\nALL NOISE SUPPRESSION TESTS PASSED: ${passed}/6`);
}

run().catch((err) => {
  console.error('\nTEST FAILED:', err);
  process.exit(1);
});
