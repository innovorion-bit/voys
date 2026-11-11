import React, { useState, useEffect, useCallback } from 'react';
import { peerService } from '../services/peerService';
import { chatService } from '../services/chatService';
import { sounds } from '../utils/audio';
import { dbService } from '../lib/supabase';
import { SettingsContext } from './settingsContextDef';
import { useAuth } from './useAuth';
import { 
  DEFAULT_PTT_KEY,
  normalizeShortcutKey,
  registerPttShortcut,
  unregisterPttShortcut,
  unregisterAllShortcuts
} from '../services/shortcutService';
import { applyWindowTransparency } from '../utils/windowManager';
import {
  STORAGE_KEYS,
  DEFAULT_AI_NOISE_SUPPRESSION,
  DEFAULT_NOISE_GATE_THRESHOLD,
  normalizeNoiseSuppressionMode,
  clampNoiseGateThreshold,
  readStoredBool,
  readStoredNumber,
  readStoredNoiseSuppressionMode,
} from '../utils/noiseSuppressionPipeline';
import { MAX_VOLUME_PERCENT, clampVolumePercent } from '../utils/remoteAudioGain';

const defaultProfile = {
  name: 'Sen (You)',
  id: 'you',
  username: 'kullanici',
  avatar: '',
  status: 'online', // 'online' | 'idle' | 'dnd' | 'invisible'
  game: '',
  substatus: 'Çevrimiçi',
  isAway: false,
};

function computeUserProfile(user) {
  if (!user || !user.id) return defaultProfile;
  let savedData = {};
  try {
    const saved = localStorage.getItem(`standupp_user_profile_${user.id}`);
    if (saved) savedData = JSON.parse(saved);
    localStorage.removeItem('standupp_user_profile');
  } catch {}

  const userAvatar =
    (user.avatar_url && typeof user.avatar_url === 'string' && user.avatar_url.trim()) ||
    (user.avatar && typeof user.avatar === 'string' && user.avatar.trim()) ||
    (savedData.id === user.id && (savedData.avatar_url || savedData.avatar)) ||
    '';

  return {
    ...defaultProfile,
    id: user.id,
    name: user.display_name || user.username || defaultProfile.name,
    display_name: user.display_name || user.username || defaultProfile.name,
    username: user.username || defaultProfile.username,
    avatar: userAvatar,
    avatar_url: userAvatar,
    status: user.status || savedData.status || 'online',
    game: user.game || savedData.game || '',
    substatus: user.substatus || savedData.substatus || 'Çevrimiçi',
    isAway: user.status === 'idle' || savedData.isAway || false,
  };
}

export const SettingsProvider = ({ children }) => {
  const { user, updateUser } = useAuth();

  // User Profile State - strictly scoped to active authenticated user
  const userKey = user && user.id
    ? `${user.id}_${user.avatar_url || ''}_${user.status || ''}_${user.display_name || ''}_${user.username || ''}_${user.substatus || ''}`
    : 'guest';
  const [prevUserKey, setPrevUserKey] = useState(userKey);
  const [profile, setProfile] = useState(() => computeUserProfile(user));

  // Synchronize profile state whenever authenticated user changes (render-time state sync)
  if (prevUserKey !== userKey) {
    setPrevUserKey(userKey);
    setProfile(computeUserProfile(user));
  }

  // Audio Devices State
  const [audioInputs, setAudioInputs] = useState([]);
  const [audioOutputs, setAudioOutputs] = useState([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState(() => {
    return localStorage.getItem('standupp_audio_input') || '';
  });
  const [selectedAudioOutput, setSelectedAudioOutput] = useState(() => {
    return localStorage.getItem('standupp_audio_output') || '';
  });
  const [inputVolume, setInputVolume] = useState(() => {
    return Number(localStorage.getItem('standupp_input_volume')) || 100;
  });
  const [outputVolume, setOutputVolume] = useState(() => {
    try {
      return clampVolumePercent(
        localStorage.getItem('standupp_output_volume'),
        MAX_VOLUME_PERCENT,
        100
      );
    } catch {
      return 100;
    }
  });

  // Advanced Audio Processing (Echo Cancellation, Noise Suppression) + Separate AGC & Anti-Static DSP
  const [advancedAudioFiltering, setAdvancedAudioFilteringState] = useState(() => {
    try {
      const saved = localStorage.getItem('standupp_advanced_audio_filtering');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [autoGainControl, setAutoGainControlState] = useState(() => {
    try {
      const saved = localStorage.getItem('standupp_auto_gain_control');
      return saved !== null ? saved === 'true' : false;
    } catch {
      return false;
    }
  });

  const [antiStaticFilter, setAntiStaticFilterState] = useState(() =>
    readStoredBool('standupp_anti_static_filter', true)
  );

  // AI Noise Suppression (RNNoise) is always enabled by default
  const aiNoiseSuppression = DEFAULT_AI_NOISE_SUPPRESSION;

  const [noiseSuppressionMode, setNoiseSuppressionModeState] = useState(() =>
    readStoredNoiseSuppressionMode()
  );

  const [noiseGateThreshold, setNoiseGateThresholdState] = useState(() =>
    clampNoiseGateThreshold(readStoredNumber(STORAGE_KEYS.noiseGateThreshold, DEFAULT_NOISE_GATE_THRESHOLD))
  );

  const updateAudioSetting = useCallback(async ({ key, setter, storageKey, payload }) => {
    setter(payload);
    try {
      localStorage.setItem(storageKey, String(payload));
    } catch {}

    try {
      await peerService.applyAudioSettings({ [key]: payload });
    } catch (err) {
      console.warn(`apply ${key} error:`, err);
    }
  }, []);

  const changeAdvancedAudioFiltering = useCallback(
    (enabled) =>
      updateAudioSetting({
        key: 'advancedAudioFiltering',
        setter: setAdvancedAudioFilteringState,
        storageKey: 'standupp_advanced_audio_filtering',
        payload: Boolean(enabled),
      }),
    [updateAudioSetting]
  );

  const changeAutoGainControl = useCallback(
    (enabled) =>
      updateAudioSetting({
        key: 'autoGainControl',
        setter: setAutoGainControlState,
        storageKey: 'standupp_auto_gain_control',
        payload: Boolean(enabled),
      }),
    [updateAudioSetting]
  );

  const changeAntiStaticFilter = useCallback(
    (enabled) =>
      updateAudioSetting({
        key: 'antiStaticFilter',
        setter: setAntiStaticFilterState,
        storageKey: 'standupp_anti_static_filter',
        payload: Boolean(enabled),
      }),
    [updateAudioSetting]
  );

  const changeNoiseSuppressionMode = useCallback(
    (mode) =>
      updateAudioSetting({
        key: 'noiseSuppressionMode',
        setter: setNoiseSuppressionModeState,
        storageKey: STORAGE_KEYS.noiseSuppressionMode,
        payload: normalizeNoiseSuppressionMode(mode),
      }),
    [updateAudioSetting]
  );

  const changeNoiseGateThreshold = useCallback(
    (threshold) =>
      updateAudioSetting({
        key: 'noiseGateThreshold',
        setter: setNoiseGateThresholdState,
        storageKey: STORAGE_KEYS.noiseGateThreshold,
        payload: clampNoiseGateThreshold(threshold),
      }),
    [updateAudioSetting]
  );

  // Synchronize peerService with initial audio processing preferences & live input volume
  useEffect(() => {
    try {
      localStorage.removeItem(STORAGE_KEYS.aiNoiseSuppression);
    } catch {}
    peerService.setAdvancedAudioFiltering(advancedAudioFiltering);
    peerService.setAutoGainControl(autoGainControl);
    peerService.setAntiStaticFilter(antiStaticFilter);
    peerService.setAiNoiseSuppression(aiNoiseSuppression);
    peerService.setNoiseSuppressionMode(noiseSuppressionMode);
    peerService.setNoiseGateThreshold(noiseGateThreshold);
  }, [
    advancedAudioFiltering,
    autoGainControl,
    antiStaticFilter,
    aiNoiseSuppression,
    noiseSuppressionMode,
    noiseGateThreshold,
  ]);

  useEffect(() => {
    peerService.setInputVolume(inputVolume);
  }, [inputVolume]);

  // Input Mode & Push-to-Talk (PTT) Configuration
  const [inputMode, setInputModeState] = useState(() => {
    const savedMode = localStorage.getItem('standupp_input_mode');
    return savedMode === 'ptt' ? 'ptt' : 'open'; // 'open' | 'ptt'
  });
  const [pttKey, setPttKeyState] = useState(() => {
    const savedKey = localStorage.getItem('standupp_ptt_key');
    return normalizeShortcutKey(savedKey) || DEFAULT_PTT_KEY;
  });
  const [isPttActive, setIsPttActive] = useState(false);
  const [isRecordingPttKey, setIsRecordingPttKey] = useState(false);
  const [pttStatus, setPttStatus] = useState({
    registered: false,
    mode: 'window',
    isTauriGlobal: false,
    warning: null,
  });

  const changeInputMode = useCallback((mode) => {
    const safeMode = mode === 'ptt' ? 'ptt' : 'open';
    setInputModeState(safeMode);
    if (safeMode !== 'ptt') {
      setIsPttActive(false);
    }
    try {
      localStorage.setItem('standupp_input_mode', safeMode);
    } catch {}
  }, []);

  const changePttKey = useCallback((key) => {
    const safeKey = normalizeShortcutKey(key) || DEFAULT_PTT_KEY;
    setIsPttActive(false);
    setPttKeyState(safeKey);
    try {
      localStorage.setItem('standupp_ptt_key', safeKey);
    } catch {}
  }, []);

  // Register / Unregister Push-to-Talk Global Shortcut dynamically
  useEffect(() => {
    let isCancelled = false;

    if (inputMode === 'ptt' && pttKey && !isRecordingPttKey) {
      registerPttShortcut(pttKey, (isPressed) => {
        if (!isCancelled) {
          setIsPttActive(Boolean(isPressed));
        }
      })
        .then((result) => {
          if (isCancelled || result?.cancelled) return;
          setPttStatus({
            registered: Boolean(result?.success),
            mode: result?.mode || 'window',
            isTauriGlobal: Boolean(result?.isTauriGlobal),
            warning: result?.warning || result?.error || null,
          });
        })
        .catch((err) => {
          if (isCancelled) return;
          console.warn('PTT shortcut register warning:', err);
          setPttStatus({
            registered: false,
            mode: 'window',
            isTauriGlobal: false,
            warning: err?.message || 'Kısayol kaydedilemedi.',
          });
        });
    } else {
      unregisterPttShortcut()
        .then(() => {
          if (!isCancelled) {
            setIsPttActive(false);
            setPttStatus({
              registered: false,
              mode: 'window',
              isTauriGlobal: false,
              warning: null,
            });
          }
        })
        .catch(() => {});
    }

    return () => {
      isCancelled = true;
      unregisterPttShortcut()
        .then(() => {
          setIsPttActive(false);
        })
        .catch(() => {});
    };
  }, [inputMode, pttKey, isRecordingPttKey]);

  // Clean up global shortcuts when app closes or unloads
  useEffect(() => {
    const handleBeforeUnload = () => {
      unregisterAllShortcuts().catch(() => {});
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      unregisterAllShortcuts().catch(() => {});
    };
  }, []);

  // Chat Settings State (Keyboard, Notifications, Appearance, Privacy)
  const [chatSettings, setChatSettings] = useState(() => {
    const fallback = {
      sendOnEnter: true,
      desktopNotifications: true,
      messageSound: true,
      fontSize: 'normal',
      timeFormat24h: false,
      showTyping: true,
      gamePerformanceMode: 'auto', // Locked to 'auto' (activates automatically while a game is running)
      screenSharePreset: 'balanced', // 'performance' | 'balanced' | 'high'
    };
    try {
      const saved = localStorage.getItem('standupp_chat_settings');
      return saved ? { ...fallback, ...JSON.parse(saved), gamePerformanceMode: 'auto' } : fallback;
    } catch {
      return fallback;
    }
  });

  // UI Sound Effects State (declared before callbacks that synchronize categories)
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(() => sounds.getEnabled());
  const [soundEffectsVolume, setSoundEffectsVolume] = useState(() => sounds.getVolume());
  const [soundCategories, setSoundCategories] = useState(() => sounds.getCategories());

  const updateChatSetting = useCallback((key, value) => {
    const normalizedValue = key === 'gamePerformanceMode' ? 'auto' : value;
    setChatSettings((prev) => {
      const next = { ...prev, [key]: normalizedValue };
      try {
        localStorage.setItem('standupp_chat_settings', JSON.stringify(next));
      } catch {}
      return next;
    });
    if (key === 'messageSound') {
      sounds.setCategoryEnabled('message', Boolean(normalizedValue));
      setSoundCategories(sounds.getCategories());
    }
  }, []);

  // Sync active theme with document element
  useEffect(() => {
    const activeTheme = chatSettings?.theme || 'dark';
    if (activeTheme === 'light') {
      document.documentElement.classList.add('theme-light');
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.classList.remove('theme-light');
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, [chatSettings?.theme]);

  // Sync window transparency & glassmorphism opacity with document root and Tauri window
  useEffect(() => {
    const rawOpacity = chatSettings?.windowOpacity;
    const opacityNum = typeof rawOpacity === 'number' ? rawOpacity : 100;
    const clampedOpacity = Math.min(100, Math.max(25, opacityNum));
    const alpha = clampedOpacity / 100;
    const blurPx = clampedOpacity === 100 ? 0 : Math.round(10 + (1 - alpha) * 20);

    document.documentElement.style.setProperty('--voys-opacity', alpha.toString());
    document.documentElement.style.setProperty('--voys-blur', `${blurPx}px`);
    document.documentElement.setAttribute('data-opacity', clampedOpacity.toString());

    if (clampedOpacity < 100) {
      document.documentElement.classList.add('glass-mode');
    } else {
      document.documentElement.classList.remove('glass-mode');
    }

    applyWindowTransparency(clampedOpacity);
  }, [chatSettings?.windowOpacity]);

  // Sync Screen Share quality preset with PeerService
  useEffect(() => {
    peerService.setScreenSharePreset(chatSettings?.screenSharePreset || 'balanced');
  }, [chatSettings?.screenSharePreset]);

  // Game Performance Mode: locked to Automatic (activates while a game is detected in profile.game)
  const isPerformanceModeActive = Boolean((profile?.game || '').trim());

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (isPerformanceModeActive) {
      document.documentElement.classList.add('voys-performance-mode');
      document.documentElement.setAttribute('data-performance-mode', 'true');
    } else {
      document.documentElement.classList.remove('voys-performance-mode');
      document.documentElement.setAttribute('data-performance-mode', 'false');
    }
  }, [isPerformanceModeActive]);

  // UI Sound Effects Callbacks
  const changeSoundEffectsEnabled = useCallback((enabled) => {
    setSoundEffectsEnabled(enabled);
    sounds.setEnabled(enabled);
  }, []);

  const changeSoundEffectsVolume = useCallback((vol) => {
    setSoundEffectsVolume(vol);
    sounds.setVolume(vol);
  }, []);

  const changeSoundCategory = useCallback((category, enabled) => {
    sounds.setCategoryEnabled(category, enabled);
    setSoundCategories(sounds.getCategories());
    if (category === 'message') {
      setChatSettings((prev) => {
        const next = { ...prev, messageSound: Boolean(enabled) };
        try {
          localStorage.setItem('standupp_chat_settings', JSON.stringify(next));
        } catch {}
        return next;
      });
    }
  }, []);

  // Settings Modal Open/Tab State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('account'); // 'account' | 'customization' | 'devices' | 'language_time'

  // Broadcast presence on mount or profile change (only for valid user id)
  useEffect(() => {
    if (profile && profile.id && profile.id !== 'you') {
      chatService.updatePresence(profile);
    }
  }, [profile]);

  // Save profile changes, sync with Supabase and broadcast presence
  const updateProfile = useCallback(async (newProfile, targetUserId) => {
    const targetId = targetUserId || newProfile.id || user?.id || profile.id;
    if (!targetId || targetId === 'you') return;

    const normalizedProfile = { ...newProfile };
    if (newProfile.avatar !== undefined || newProfile.avatar_url !== undefined) {
      const resolvedAvatar = newProfile.avatar_url !== undefined ? newProfile.avatar_url : newProfile.avatar;
      normalizedProfile.avatar = resolvedAvatar;
      normalizedProfile.avatar_url = resolvedAvatar;
    }

    setProfile((prev) => {
      const updated = { ...prev, ...normalizedProfile, id: targetId };
      try {
        localStorage.setItem(`standupp_user_profile_${targetId}`, JSON.stringify(updated));
      } catch {}
      chatService.updatePresence(updated);
      return updated;
    });

    if (updateUser) {
      updateUser(normalizedProfile);
    }

    try {
      await dbService.updateUserProfile(targetId, normalizedProfile);
    } catch (err) {
      console.warn('updateProfile in DB warning:', err);
    }
  }, [user?.id, profile.id, updateUser]);

  const uploadAvatarFile = useCallback(async (file, targetUserId) => {
    const targetId = targetUserId || user?.id || profile.id;
    return await dbService.uploadAvatar(file, targetId);
  }, [user?.id, profile.id]);

  // Enumerate audio hardware devices
  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;

    try {
      let devices = await navigator.mediaDevices.enumerateDevices();
      
      // If device labels are blank, prompt for microphone access to unlock labels
      const hasLabels = devices.some(d => d.label && d.label.length > 0);
      if (!hasLabels) {
        try {
          const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          devices = await navigator.mediaDevices.enumerateDevices();
          tempStream.getTracks().forEach(t => t.stop());
        } catch {}
      }

      const inputs = devices
        .filter(d => d.kind === 'audioinput')
        .map((d, index) => ({
          deviceId: d.deviceId,
          label: d.label || `Mikrofon ${index + 1}`,
        }));

      const outputs = devices
        .filter(d => d.kind === 'audiooutput')
        .map((d, index) => ({
          deviceId: d.deviceId,
          label: d.label || `Hoparlör / Kulaklık ${index + 1}`,
        }));

      setAudioInputs(inputs);
      setAudioOutputs(outputs);

      // Set default selected devices if not already set or invalid
      if (inputs.length > 0 && !inputs.some(i => i.deviceId === selectedAudioInput)) {
        const defaultInput = inputs[0].deviceId;
        setSelectedAudioInput(defaultInput);
        try { localStorage.setItem('standupp_audio_input', defaultInput); } catch {}
      }

      if (outputs.length > 0 && !outputs.some(o => o.deviceId === selectedAudioOutput)) {
        const defaultOutput = outputs[0].deviceId;
        setSelectedAudioOutput(defaultOutput);
        try { localStorage.setItem('standupp_audio_output', defaultOutput); } catch {}
      }
    } catch (err) {
      console.warn('enumerateDevices error:', err);
    }
  }, [selectedAudioInput, selectedAudioOutput]);

  // Handle switching audio input device dynamically in WebRTC
  const changeAudioInput = useCallback(async (deviceId) => {
    setSelectedAudioInput(deviceId);
    try {
      localStorage.setItem('standupp_audio_input', deviceId);
    } catch {}

    // Seamlessly swap audio track in PeerJS mesh calls without hanging up
    try {
      await peerService.switchAudioInput(deviceId);
    } catch (err) {
      console.error('Failed to switch audio input device:', err);
    }
  }, []);

  // Handle switching audio output device
  const changeAudioOutput = useCallback((deviceId) => {
    setSelectedAudioOutput(deviceId);
    try {
      localStorage.setItem('standupp_audio_output', deviceId);
    } catch {}
  }, []);

  // Update volume settings
  const changeInputVolume = useCallback((val) => {
    setInputVolume(val);
    peerService.setInputVolume(val);
    try { localStorage.setItem('standupp_input_volume', String(val)); } catch {}
  }, []);

  const changeOutputVolume = useCallback((val) => {
    const clamped = clampVolumePercent(val, MAX_VOLUME_PERCENT, 100);
    setOutputVolume(clamped);
    try { localStorage.setItem('standupp_output_volume', String(clamped)); } catch {}
  }, []);

  // Listen to hardware device plug/unplug events
  useEffect(() => {
    const timer = setTimeout(() => {
      refreshDevices();
    }, 0);

    const handleDeviceChange = () => {
      refreshDevices();
    };

    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
      return () => {
        clearTimeout(timer);
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      };
    }
    return () => clearTimeout(timer);
  }, [refreshDevices]);

  const openSettings = useCallback((tab = 'account') => {
    setIsRecordingPttKey(false);
    setSettingsTab(tab);
    setIsSettingsOpen(true);
    refreshDevices();
  }, [refreshDevices]);

  const closeSettings = useCallback(() => {
    setIsRecordingPttKey(false);
    setIsSettingsOpen(false);
  }, []);

  const updateSettingsTab = useCallback((tab) => {
    setIsRecordingPttKey(false);
    setSettingsTab(tab);
  }, []);

  const [isChatSettingsOpen, setIsChatSettingsOpen] = useState(false);
  const openChatSettings = useCallback(() => {
    setIsChatSettingsOpen(true);
  }, []);

  const closeChatSettings = useCallback(() => {
    setIsChatSettingsOpen(false);
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        profile,
        updateProfile,
        uploadAvatarFile,
        audioInputs,
        audioOutputs,
        selectedAudioInput,
        selectedAudioOutput,
        changeAudioInput,
        changeAudioOutput,
        inputVolume,
        outputVolume,
        changeInputVolume,
        changeOutputVolume,
        soundEffectsEnabled,
        soundEffectsVolume,
        soundCategories,
        changeSoundEffectsEnabled,
        changeSoundEffectsVolume,
        changeSoundCategory,
        advancedAudioFiltering,
        changeAdvancedAudioFiltering,
        autoGainControl,
        changeAutoGainControl,
        antiStaticFilter,
        changeAntiStaticFilter,
        aiNoiseSuppression,
        noiseSuppressionMode,
        changeNoiseSuppressionMode,
        noiseGateThreshold,
        changeNoiseGateThreshold,
        inputMode,
        changeInputMode,
        pttKey,
        changePttKey,
        isPttActive,
        isRecordingPttKey,
        setIsRecordingPttKey,
        pttStatus,
        refreshDevices,
        isSettingsOpen,
        settingsTab,
        setSettingsTab: updateSettingsTab,
        openSettings,
        closeSettings,
        isChatSettingsOpen,
        openChatSettings,
        closeChatSettings,
        chatSettings,
        updateChatSetting,
        isPerformanceModeActive,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};
