import assert from 'node:assert/strict';
import {
  MAX_VOLUME_PERCENT,
  MAX_BOOST_GAIN,
  clampVolumePercent,
  computeRemoteAudioGain,
  getVolumeSliderFillStyle,
  createRemoteBoostGraph,
  updateRemoteBoostGraph,
  teardownRemoteBoostGraph,
} from '../src/utils/remoteAudioGain.js';

const test = (name, fn) => {
  try {
    fn();
    console.log(`PASS: ${name}`);
  } catch (err) {
    console.error(`FAIL: ${name}`);
    throw err;
  }
};

const createAudioParam = (initial = 0) => {
  const param = {
    value: initial,
    lastTarget: null,
    setValueAtTime(v) {
      param.value = v;
    },
    setTargetAtTime(v) {
      param.lastTarget = v;
      param.value = v;
    },
  };
  return param;
};

const createMockAudioContext = () => {
  const created = { sources: [], gains: [], limiters: [], destinations: [] };
  const makeNode = (kind) => ({
    kind,
    connections: [],
    disconnected: false,
    connect(target) {
      this.connections.push(target);
      return target;
    },
    disconnect() {
      this.disconnected = true;
    },
  });

  const ctx = {
    currentTime: 1.25,
    state: 'running',
    createMediaStreamSource(stream) {
      const node = { ...makeNode('source'), stream };
      created.sources.push(node);
      return node;
    },
    createGain() {
      const node = { ...makeNode('gain'), gain: createAudioParam(1) };
      created.gains.push(node);
      return node;
    },
    createDynamicsCompressor() {
      const node = {
        ...makeNode('compressor'),
        threshold: createAudioParam(-24),
        knee: createAudioParam(30),
        ratio: createAudioParam(12),
        attack: createAudioParam(0.003),
        release: createAudioParam(0.25),
      };
      created.limiters.push(node);
      return node;
    },
    createMediaStreamDestination() {
      let trackStopped = false;
      const node = {
        ...makeNode('destination'),
        stream: {
          id: 'dest-stream',
          getTracks() {
            return [{ stop() { trackStopped = true; } }];
          },
          isStopped() {
            return trackStopped;
          },
        },
      };
      created.destinations.push(node);
      return node;
    },
    __created: created,
  };
  return ctx;
};

test('clampVolumePercent preserves 0, handles invalid values, and caps at 200%', () => {
  assert.equal(clampVolumePercent(0), 0);
  assert.equal(clampVolumePercent('0'), 0);
  assert.equal(clampVolumePercent(null), 100);
  assert.equal(clampVolumePercent(undefined), 100);
  assert.equal(clampVolumePercent(''), 100);
  assert.equal(clampVolumePercent('abc'), 100);
  assert.equal(clampVolumePercent(-25), 0);
  assert.equal(clampVolumePercent(145.6), 146);
  assert.equal(clampVolumePercent(250), MAX_VOLUME_PERCENT);
});

test('computeRemoteAudioGain distinguishes native playback (<=100%) from Web Audio boost (>100%)', () => {
  const normal = computeRemoteAudioGain({ volume: 1, peerVolume: 100 });
  assert.equal(normal.totalGain, 1);
  assert.equal(normal.requiresWebAudioBoost, false);
  assert.equal(normal.nativeAudioVolume, 1);

  const quietFriendBoosted = computeRemoteAudioGain({ volume: 1, peerVolume: 175 });
  assert.equal(quietFriendBoosted.totalGain, 1.75);
  assert.equal(quietFriendBoosted.requiresWebAudioBoost, true);
  assert.equal(quietFriendBoosted.nativeAudioVolume, 1);

  const attenuatedByMaster = computeRemoteAudioGain({ volume: 0.5, peerVolume: 180 });
  assert.equal(attenuatedByMaster.totalGain, 0.9);
  assert.equal(attenuatedByMaster.requiresWebAudioBoost, false);
  assert.equal(attenuatedByMaster.nativeAudioVolume, 0.9);

  const combinedMax = computeRemoteAudioGain({ volume: 2.0, peerVolume: 200 });
  assert.equal(combinedMax.totalGain, MAX_BOOST_GAIN);
  assert.equal(combinedMax.requiresWebAudioBoost, true);

  const deafened = computeRemoteAudioGain({ volume: 1.5, peerVolume: 200, isDeafened: true });
  assert.equal(deafened.effectiveMuted, true);
  assert.equal(deafened.totalGain, 0);
  assert.equal(deafened.requiresWebAudioBoost, false);
  assert.equal(deafened.nativeAudioVolume, 0);

  const zeroVolume = computeRemoteAudioGain({ volume: 1, peerVolume: 0 });
  assert.equal(zeroVolume.effectiveMuted, true);
  assert.equal(zeroVolume.totalGain, 0);
  assert.equal(zeroVolume.requiresWebAudioBoost, false);
});

test('getVolumeSliderFillStyle renders dual-zone track at 100% midpoint for boost ranges', () => {
  const midStyle = getVolumeSliderFillStyle(100, 200, '#10b981', '#f59e0b', '#232428');
  assert.equal(midStyle.includes('#10b981 50%'), true);
  assert.equal(midStyle.includes('#f59e0b'), false);

  const boostedStyle = getVolumeSliderFillStyle(160, 200, '#10b981', '#f59e0b', '#232428');
  assert.equal(boostedStyle.includes('#10b981 50%, #f59e0b 50%, #f59e0b 80%'), true);
});

test('Remote Web Audio boost graph wires source -> gain -> limiter -> destination with muted Chromium anchor', () => {
  const ctx = createMockAudioContext();
  const rawStream = { id: 'raw-webrtc-stream' };
  let anchorPlayed = false;
  let anchorPaused = false;
  const anchorEl = {
    muted: false,
    srcObject: null,
    play() {
      anchorPlayed = true;
      return Promise.resolve();
    },
    pause() {
      anchorPaused = true;
    },
  };

  const graph = createRemoteBoostGraph({
    ctx,
    stream: rawStream,
    anchorEl,
    initialGain: 1.8,
  });

  assert.equal(anchorEl.muted, true);
  assert.equal(anchorEl.srcObject, rawStream);
  assert.equal(anchorPlayed, true);
  assert.equal(ctx.__created.sources[0].connections[0], graph.gainNode);
  assert.equal(graph.gainNode.connections[0], graph.limiter);
  assert.equal(graph.limiter.connections[0], graph.destination);
  assert.equal(graph.gainNode.gain.value, 1.8);
  assert.equal(graph.limiter.threshold.value, -1.5);
  assert.equal(graph.limiter.ratio.value, 12);

  // Dragging volume down below 100% disables limiter compression cleanly without rebuilding graph
  updateRemoteBoostGraph({ graph, totalGain: 0.75, anchorEl });
  assert.equal(graph.gainNode.gain.value, 0.75);
  assert.equal(graph.limiter.threshold.value, 0);
  assert.equal(graph.limiter.ratio.value, 1);

  teardownRemoteBoostGraph({ graph, anchorEl });
  assert.equal(graph.source.disconnected, true);
  assert.equal(graph.gainNode.disconnected, true);
  assert.equal(graph.limiter.disconnected, true);
  assert.equal(graph.destination.disconnected, true);
  assert.equal(graph.destination.stream.isStopped(), true);
  assert.equal(anchorPaused, true);
  assert.equal(anchorEl.srcObject, null);
});

console.log('All remote audio boost tests passed!');
