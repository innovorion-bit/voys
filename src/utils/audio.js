// UI Sound Effects Engine with open-source WAV assets and Web Audio API fallback
export const DEFAULT_SOUND_CATEGORIES = {
  ptt: true,
  voiceConnection: true,
  voiceActions: true,
  message: true,
  ringtone: true,
};

const SOUND_DEFAULT_CATEGORIES = {
  join: 'voiceConnection',
  leave: 'voiceConnection',
  mute: 'voiceActions',
  unmute: 'voiceActions',
  deafen: 'voiceActions',
  undeafen: 'voiceActions',
  message: 'message',
};

class SoundEffects {
  constructor() {
    this.ctx = null;
    this.categories = { ...DEFAULT_SOUND_CATEGORIES };

    // Load persisted sound settings from localStorage
    if (typeof window !== 'undefined') {
      try {
        const savedEnabled = localStorage.getItem('standupp_sound_effects_enabled');
        this.enabled = savedEnabled !== null ? savedEnabled !== 'false' : true;

        const savedVol = localStorage.getItem('standupp_sound_effects_volume');
        this.volume = savedVol !== null ? Math.max(0, Math.min(100, Number(savedVol))) / 100 : 0.75;

        const savedCategories = localStorage.getItem('standupp_sound_categories');
        if (savedCategories) {
          const parsed = JSON.parse(savedCategories);
          if (parsed && typeof parsed === 'object') {
            this.categories = {
              ...DEFAULT_SOUND_CATEGORIES,
              ...Object.fromEntries(
                Object.keys(DEFAULT_SOUND_CATEGORIES).map((k) => [
                  k,
                  parsed[k] !== undefined ? Boolean(parsed[k]) : DEFAULT_SOUND_CATEGORIES[k],
                ])
              ),
            };
          }
        }
      } catch {
        this.enabled = true;
        this.volume = 0.75;
        this.categories = { ...DEFAULT_SOUND_CATEGORIES };
      }
    } else {
      this.enabled = true;
      this.volume = 0.75;
    }

    // Audio file endpoints located in public/sounds
    this.soundUrls = {
      join: '/sounds/join.wav',
      leave: '/sounds/leave.wav',
      message: '/sounds/message.wav',
      mute: '/sounds/mute.wav',
      unmute: '/sounds/unmute.wav',
      deafen: '/sounds/deafen.wav',
      undeafen: '/sounds/undeafen.wav',
    };

    // Ringing state tracking
    this.activeRingTimeout = null;
    this.activeRingNodes = [];
    this.isRinging = false;
  }

  // Volume & Enabled Control
  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('standupp_sound_effects_enabled', String(this.enabled));
      } catch {}
    }
  }

  getEnabled() {
    return this.enabled;
  }

  setVolume(vol) {
    // Accepts 0..1 or 0..100
    const normalized = vol > 1 ? vol / 100 : vol;
    this.volume = Math.max(0, Math.min(1, Number(normalized) || 0));
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('standupp_sound_effects_volume', String(Math.round(this.volume * 100)));
      } catch {}
    }
  }

  getVolume() {
    return Math.round(this.volume * 100);
  }

  getCategories() {
    return { ...this.categories };
  }

  isCategoryEnabled(category) {
    if (!category) return true;
    return this.categories[category] !== false;
  }

  setCategoryEnabled(category, enabled) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_SOUND_CATEGORIES, category)) return;
    this.categories = {
      ...this.categories,
      [category]: !!enabled,
    };
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('standupp_sound_categories', JSON.stringify(this.categories));
      } catch {}
    }
  }

  setAllCategoriesEnabled(enabled) {
    const next = {};
    Object.keys(DEFAULT_SOUND_CATEGORIES).forEach((k) => {
      next[k] = !!enabled;
    });
    this.categories = next;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('standupp_sound_categories', JSON.stringify(this.categories));
      } catch {}
    }
  }

  canPlay({ category = null, ignoreEnabled = false, minVolume = 0 } = {}) {
    if (!ignoreEnabled) {
      if (!this.enabled || this.volume <= 0) return false;
      if (category && !this.isCategoryEnabled(category)) return false;
      return true;
    }
    return Math.max(this.volume, minVolume) > 0;
  }

  initWebAudio() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  // Primary playback function using high-fidelity WAV files with Web Audio fallback
  play(soundName, options = {}) {
    const category = options.category || SOUND_DEFAULT_CATEGORIES[soundName] || null;
    const playOptions = { ...options, category };
    if (!this.canPlay(playOptions)) return;

    const effectiveVolume = playOptions.ignoreEnabled
      ? Math.max(this.volume, playOptions.minVolume || 0)
      : this.volume;

    const url = this.soundUrls[soundName];
    if (url && typeof window !== 'undefined' && typeof Audio !== 'undefined') {
      try {
        const audio = new Audio(url);
        audio.volume = effectiveVolume;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // If browser autoplay blocks or file fetch fails, fallback to synth
            this.playFallbackSynth(soundName, playOptions);
          });
        }
        return;
      } catch {
        this.playFallbackSynth(soundName, playOptions);
      }
    } else {
      this.playFallbackSynth(soundName, playOptions);
    }
  }

  // Web Audio API Synthesizer Fallback
  playFallbackSynth(soundName, options = {}) {
    const category = options.category || SOUND_DEFAULT_CATEGORIES[soundName] || null;
    const playOptions = { ...options, category };
    if (!this.canPlay(playOptions)) return;

    this.initWebAudio();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const effectiveVolume = playOptions.ignoreEnabled
        ? Math.max(this.volume, playOptions.minVolume || 0)
        : this.volume;
      const masterGain = effectiveVolume * 0.12;

      switch (soundName) {
        case 'join': {
          // Ascending 3-tone chime (A4 -> C#5 -> E5)
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.setValueAtTime(554.37, now + 0.08);
          osc.frequency.setValueAtTime(659.25, now + 0.16);
          gain.gain.setValueAtTime(masterGain, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.32);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now);
          osc.stop(now + 0.32);
          break;
        }

        case 'leave': {
          // Descending 2-tone chime (E5 -> A4)
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(659.25, now);
          osc.frequency.setValueAtTime(440, now + 0.1);
          gain.gain.setValueAtTime(masterGain, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.26);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now);
          osc.stop(now + 0.26);
          break;
        }

        case 'message': {
          // Short crisp sine blip
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(600, now);
          osc.frequency.exponentialRampToValueAtTime(950, now + 0.07);
          gain.gain.setValueAtTime(masterGain * 0.9, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.12);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now);
          osc.stop(now + 0.12);
          break;
        }

        case 'mute': {
          // Downward soft click
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(460, now);
          osc.frequency.exponentialRampToValueAtTime(230, now + 0.1);
          gain.gain.setValueAtTime(masterGain * 0.8, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.1);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now);
          osc.stop(now + 0.1);
          break;
        }

        case 'unmute': {
          // Upward soft click
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(260, now);
          osc.frequency.exponentialRampToValueAtTime(520, now + 0.1);
          gain.gain.setValueAtTime(masterGain * 0.8, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.1);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now);
          osc.stop(now + 0.1);
          break;
        }

        case 'deafen': {
          // Dual drop tone
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(392, now);
          osc.frequency.setValueAtTime(293, now + 0.05);
          gain.gain.setValueAtTime(masterGain * 0.85, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.15);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now);
          osc.stop(now + 0.15);
          break;
        }

        case 'undeafen': {
          // Dual bright chime
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(330, now);
          osc.frequency.setValueAtTime(520, now + 0.05);
          gain.gain.setValueAtTime(masterGain * 0.85, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.15);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now);
          osc.stop(now + 0.15);
          break;
        }

        default:
          break;
      }
    } catch {}
  }

  // Explicit Sound Action Methods
  playJoin() {
    this.play('join');
  }

  playLeave() {
    this.play('leave');
  }

  playMessage() {
    this.play('message');
  }

  playMute() {
    this.play('mute', { category: 'voiceActions' });
  }

  playUnmute() {
    this.play('unmute', { category: 'voiceActions' });
  }

  playPttMute() {
    this.play('mute', { category: 'ptt' });
  }

  playPttUnmute() {
    this.play('unmute', { category: 'ptt' });
  }

  playDeafen() {
    this.play('deafen', { category: 'voiceActions' });
  }

  playUndeafen() {
    this.play('undeafen', { category: 'voiceActions' });
  }

  playConnect() {
    this.play('join', { category: 'voiceConnection' });
  }

  playDisconnect() {
    this.play('leave', { category: 'voiceConnection' });
  }

  // Explicit hardware speaker test tone (works even when UI sound effects are muted)
  playTestTone() {
    this.play('join', { ignoreEnabled: true, minVolume: 0.6 });
  }

  // Web Audio Ringtone Generator (Discord-style incoming and outgoing ringtones)
  playSingleRing(type = 'incoming') {
    if (!this.canPlay({ category: 'ringtone' })) return;
    this.initWebAudio();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const masterGain = this.volume * 0.16;

      if (type === 'incoming') {
        // Melodic Discord style incoming call chime (C5 -> D5 -> G5 -> E5 -> C6 chime)
        const notes = [
          { freq: 523.25, start: 0, dur: 0.16 },
          { freq: 587.33, start: 0.16, dur: 0.16 },
          { freq: 783.99, start: 0.32, dur: 0.22 },
          { freq: 659.25, start: 0.54, dur: 0.35 },
          { freq: 1046.50, start: 0.85, dur: 0.30 },
        ];

        notes.forEach(({ freq, start, dur }) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + start);

          gain.gain.setValueAtTime(0.001, now + start);
          gain.gain.exponentialRampToValueAtTime(masterGain, now + start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);

          osc.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start(now + start);
          osc.stop(now + start + dur);

          this.activeRingNodes.push(osc);
        });
      } else {
        // Soft outgoing telephone call ring tone (dual 440Hz + 480Hz tone)
        const freqs = [440, 480];
        freqs.forEach((f) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now);

          gain.gain.setValueAtTime(0.001, now);
          gain.gain.exponentialRampToValueAtTime(masterGain * 0.45, now + 0.06);
          gain.gain.setValueAtTime(masterGain * 0.45, now + 1.15);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 1.30);

          osc.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start(now);
          osc.stop(now + 1.30);

          this.activeRingNodes.push(osc);
        });
      }
    } catch (err) {
      console.warn('Ring tone error:', err);
    }
  }

  startRinging({ type = 'incoming', maxRings = 3, onRing = null, onFinish = null } = {}) {
    this.stopRinging();
    this.isRinging = true;

    let current = 0;
    const ringInterval = type === 'incoming' ? 2400 : 2800;

    const ringStep = () => {
      if (!this.isRinging) return;
      current += 1;
      onRing?.(current);
      this.playSingleRing(type);

      if (current >= maxRings) {
        this.activeRingTimeout = setTimeout(() => {
          if (this.isRinging) {
            this.stopRinging();
            onFinish?.();
          }
        }, ringInterval);
      } else {
        this.activeRingTimeout = setTimeout(ringStep, ringInterval);
      }
    };

    ringStep();
  }

  stopRinging() {
    this.isRinging = false;
    if (this.activeRingTimeout) {
      clearTimeout(this.activeRingTimeout);
      this.activeRingTimeout = null;
    }
    if (this.activeRingNodes && this.activeRingNodes.length > 0) {
      this.activeRingNodes.forEach((node) => {
        try {
          node.stop();
          node.disconnect();
        } catch {}
      });
      this.activeRingNodes = [];
    }
  }
}

export { SoundEffects };
export const sounds = new SoundEffects();
