// UI Sound Effects Engine - Completely Disabled
export const DEFAULT_SOUND_CATEGORIES = {
  voiceConnection: false,
  message: false,
};

class SoundEffects {
  constructor() {
    this.enabled = false;
    this.volume = 0;
    this.categories = {
      voiceConnection: false,
      message: false,
    };
  }

  setEnabled() {
    this.enabled = false;
  }

  getEnabled() {
    return false;
  }

  setVolume() {
    this.volume = 0;
  }

  getVolume() {
    return 0;
  }

  getCategories() {
    return { ...this.categories };
  }

  isCategoryEnabled() {
    return false;
  }

  setCategoryEnabled() {}

  setAllCategoriesEnabled() {}

  canPlay() {
    return false;
  }

  initWebAudio() {}

  play() {}

  playFallbackSynth() {}

  // Explicit Sound Action Methods (all completely disabled)
  playJoin() {}

  playLeave() {}

  playMessage() {}

  playMute() {}

  playUnmute() {}

  playPttMute() {}

  playPttUnmute() {}

  playDeafen() {}

  playUndeafen() {}

  playConnect() {}

  playDisconnect() {}

  playTestTone() {}
}

export { SoundEffects };
export const sounds = new SoundEffects();
