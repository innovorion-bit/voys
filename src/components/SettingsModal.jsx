import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, 
  Mic, 
  Volume2, 
  User, 
  Check, 
  RefreshCw, 
  Sliders, 
  Play, 
  Square,
  Upload,
  Camera,
  Trash2,
  Loader2,
  LogOut,
  ArrowLeft,
  Palette,
  Headphones,
  Clock,
  Globe,
  Type,
  ShieldCheck,
  Calendar,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  Mail,
  AtSign,
  ChevronDown,
  Moon,
  Sun,
  Pencil,
  Activity,
  Keyboard,
  Radio,
  RotateCcw,
  VolumeX,
  Monitor
} from 'lucide-react';
import { toast } from 'sonner';
import { useSettings } from '../context/useSettings';
import { useAuth } from '../context/useAuth';
import { sounds } from '../utils/audio';
import { SCREEN_SHARE_PRESETS } from '../services/peerService';
import { dbService, isAuthorizedAdminUser } from '../lib/supabase';
import { AdminMonitorTab } from './AdminMonitorTab';
import {
  DEFAULT_PTT_KEY,
  formatShortcutLabel,
  formatKeyboardEventToShortcut,
  formatMouseEventToShortcut,
} from '../services/shortcutService';
import { isTauriEnvironment } from '../utils/windowManager';
import {
  buildMicDspChain,
  createVoiceAudioContext,
} from '../utils/noiseSuppressionPipeline';
import { MAX_VOLUME_PERCENT, getVolumeSliderFillStyle } from '../utils/remoteAudioGain';

export const TurkeyFlag = ({ className = "w-5 h-3.5" }) => (
  <svg viewBox="0 0 1200 800" className={`${className} rounded-[2px] shadow-sm flex-shrink-0 inline-block`}>
    <rect width="1200" height="800" fill="#E30A17" />
    <circle cx="425" cy="400" r="200" fill="#ffffff" />
    <circle cx="475" cy="400" r="160" fill="#E30A17" />
    <polygon
      fill="#ffffff"
      points="583.33,400 706.87,440.13 659.83,319.87 659.83,480.13 706.87,359.87"
    />
  </svg>
);

export const UKFlag = ({ className = "w-5 h-3.5" }) => (
  <svg viewBox="0 0 60 30" className={`${className} rounded-[2px] shadow-sm flex-shrink-0 inline-block`}>
    <clipPath id="uk-flag-clip">
      <path d="M0,0 v30 h60 v-30 z"/>
    </clipPath>
    <clipPath id="uk-flag-diag">
      <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/>
    </clipPath>
    <g clipPath="url(#uk-flag-clip)">
      <path d="M0,0 v30 h60 v-30 z" fill="#012169"/>
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6"/>
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="4" clipPath="url(#uk-flag-diag)"/>
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10"/>
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6"/>
    </g>
  </svg>
);

export const SettingsModal = ({ onLogout = null, onUserDeleted = null }) => {
  const { user: authUser, updateEmail, updatePassword } = useAuth();
  const {
    profile,
    updateProfile,
    uploadAvatarFile,
    audioInputs,
    audioOutputs,
    selectedAudioInput,
    selectedAudioOutput,
    inputVolume,
    outputVolume,
    changeAudioInput,
    changeAudioOutput,
    changeInputVolume,
    changeOutputVolume,
    soundEffectsEnabled,
    soundEffectsVolume,
    changeSoundEffectsEnabled,
    changeSoundEffectsVolume,
    advancedAudioFiltering,
    autoGainControl,
    antiStaticFilter,
    noiseSuppressionMode,
    noiseGateThreshold,
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
    setSettingsTab,
    closeSettings,
    chatSettings,
    updateChatSetting,
  } = useSettings();

  // Normalize active tab (Hesap, Özelleştirme, Aygıt, Dil ve Saat)
  const isAdmin = isAuthorizedAdminUser(authUser);

  const activeTab = (
    settingsTab === 'devices' || settingsTab === 'audio' ? 'devices' :
    settingsTab === 'customization' ? 'customization' :
    settingsTab === 'language_time' ? 'language_time' :
    settingsTab === 'system_monitor' && isAdmin ? 'system_monitor' :
    'account'
  );

  const isLight = chatSettings?.theme === 'light';

  // Get active avatar strictly belonging to current authenticated user
  const authUserAvatar = (profile?.id === authUser?.id ? (profile.avatar || profile.avatar_url) : '') || authUser?.avatar_url || authUser?.avatar || '';

  // Local form state for Profile & Account
  const [avatarInput, setAvatarInput] = useState(authUserAvatar);
  const [displayNameInput, setDisplayNameInput] = useState(profile?.name || authUser?.display_name || '');
  const [usernameInput, setUsernameInput] = useState(profile?.username || authUser?.username || '');
  const [emailInput, setEmailInput] = useState(authUser?.email || profile?.email || '');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [prevIsOpen, setPrevIsOpen] = useState(isSettingsOpen);
  const [prevAuthUserAvatar, setPrevAuthUserAvatar] = useState(authUserAvatar);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const avatarFileInputRef = useRef(null);

  // Field editing states for Account Settings (locked by default)
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isEditingDisplayName, setIsEditingDisplayName] = useState(false);
  const usernameInputRef = useRef(null);
  const emailInputRef = useRef(null);
  const displayNameInputRef = useRef(null);

  const toggleEditUsername = () => {
    setIsEditingUsername((prev) => {
      const next = !prev;
      if (next) setTimeout(() => usernameInputRef.current?.focus(), 50);
      return next;
    });
  };

  const toggleEditEmail = () => {
    setIsEditingEmail((prev) => {
      const next = !prev;
      if (next) setTimeout(() => emailInputRef.current?.focus(), 50);
      return next;
    });
  };

  const toggleEditDisplayName = () => {
    setIsEditingDisplayName((prev) => {
      const next = !prev;
      if (next) setTimeout(() => displayNameInputRef.current?.focus(), 50);
      return next;
    });
  };

  // Password update form state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Live time ticker for Dil ve Saat preview
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  useEffect(() => {
    const updateTicker = () => {
      const now = new Date();
      const is24h = chatSettings?.timeFormat24h !== false;
      const hours = is24h ? String(now.getHours()).padStart(2, '0') : String(now.getHours() % 12 || 12);
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const suffix = is24h ? '' : (now.getHours() >= 12 ? ' PM' : ' AM');
      setCurrentTimeStr(`${hours}:${minutes}${suffix}`);
    };
    updateTicker();
    const timer = setInterval(updateTicker, 1000);
    return () => clearInterval(timer);
  }, [chatSettings?.timeFormat24h]);

  // Custom language selector dropdown state
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const langDropdownRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(e.target)) {
        setIsLangDropdownOpen(false);
      }
    };
    if (isLangDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isLangDropdownOpen]);

  // Sync inputs when modal opens or authUserAvatar changes
  if (prevIsOpen !== isSettingsOpen || prevAuthUserAvatar !== authUserAvatar) {
    setPrevIsOpen(isSettingsOpen);
    setPrevAuthUserAvatar(authUserAvatar);
    if (isSettingsOpen) {
      setAvatarInput(authUserAvatar);
      setDisplayNameInput(profile?.name || authUser?.display_name || '');
      setUsernameInput(profile?.username || authUser?.username || '');
      setEmailInput(authUser?.email || profile?.email || '');
      setNewPassword('');
      setConfirmPassword('');
      setIsEditingUsername(false);
      setIsEditingEmail(false);
      setIsEditingDisplayName(false);
    }
  }

  // Live Mic Test State
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micVolumeLevel, setMicVolumeLevel] = useState(0); // 0 to 100
  const testAudioCtxRef = useRef(null);
  const testAnimFrameRef = useRef(null);

  // Push-to-Talk Keybind Recorder State
  const [pendingPttModifiers, setPendingPttModifiers] = useState([]);
  const pendingSoloModifierRef = useRef(null);
  const pttRecorderBoxRef = useRef(null);

  const stopPttRecording = useCallback(() => {
    pendingSoloModifierRef.current = null;
    setPendingPttModifiers([]);
    setIsRecordingPttKey(false);
  }, [setIsRecordingPttKey]);

  const isPttRecordingActive = Boolean(isRecordingPttKey && isSettingsOpen && activeTab === 'devices');

  useEffect(() => {
    if (!isPttRecordingActive) return undefined;

    const getModifierLabels = (ev) => {
      const mods = [];
      if (ev.ctrlKey) mods.push('Ctrl');
      if (ev.altKey) mods.push('Alt');
      if (ev.shiftKey) mods.push('Shift');
      if (ev.metaKey) mods.push('Win');
      return mods;
    };

    const commitKeybind = (nextKey) => {
      pendingSoloModifierRef.current = null;
      setPendingPttModifiers([]);
      changePttKey(nextKey);
      setIsRecordingPttKey(false);
      toast.success(`Bas-Konuş tuşu ayarlandı: ${formatShortcutLabel(nextKey)}`);
    };

    const handleKeyDown = (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        stopPttRecording();
        return;
      }

      if (e.repeat) return;

      const combo = formatKeyboardEventToShortcut(e, { allowModifierOnly: false });
      if (combo) {
        commitKeybind(combo);
        return;
      }

      const mods = getModifierLabels(e);
      setPendingPttModifiers(mods);
      const soloMod = formatKeyboardEventToShortcut(e, { allowModifierOnly: true });
      pendingSoloModifierRef.current = mods.length === 1 && soloMod ? soloMod : null;
    };

    const handleKeyUp = (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (pendingSoloModifierRef.current) {
        commitKeybind(pendingSoloModifierRef.current);
        return;
      }
      setPendingPttModifiers(getModifierLabels(e));
    };

    const handleMouseDown = (e) => {
      const mouseShortcut = formatMouseEventToShortcut(e);
      if (mouseShortcut) {
        e.preventDefault();
        e.stopPropagation();
        commitKeybind(mouseShortcut);
        return;
      }
      if ((e.button === 0 || e.button === 2) && pttRecorderBoxRef.current && !pttRecorderBoxRef.current.contains(e.target)) {
        stopPttRecording();
      }
    };

    const handleAuxClick = (e) => {
      if (e.button === 1 || e.button === 3 || e.button === 4) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handleBlur = () => {
      stopPttRecording();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('mousedown', handleMouseDown, true);
    window.addEventListener('auxclick', handleAuxClick, true);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('mousedown', handleMouseDown, true);
      window.removeEventListener('auxclick', handleAuxClick, true);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isPttRecordingActive, changePttKey, setIsRecordingPttKey, stopPttRecording]);

  const micTestGenRef = useRef(0);

  const cleanupMicTestResources = useCallback(() => {
    micTestGenRef.current += 1;
    if (testAnimFrameRef.current) {
      cancelAnimationFrame(testAnimFrameRef.current);
      testAnimFrameRef.current = null;
    }
    if (testAudioCtxRef.current) {
      try {
        testAudioCtxRef.current.chainCleanup?.();
      } catch {}
      testAudioCtxRef.current.stream?.getTracks().forEach(t => t.stop());
      testAudioCtxRef.current.ctx?.close().catch(() => {});
      testAudioCtxRef.current = null;
    }
  }, []);

  // Stop mic test helper
  const stopMicTest = useCallback(() => {
    cleanupMicTestResources();
    setIsTestingMic(false);
    setMicVolumeLevel(0);
  }, [cleanupMicTestResources]);

  // Clean up mic test on unmount
  useEffect(() => cleanupMicTestResources, [cleanupMicTestResources]);

  const startMicTest = async () => {
    stopMicTest();
    const runId = ++micTestGenRef.current;
    try {
      const constraints = {
        audio: {
          ...(selectedAudioInput ? { deviceId: { exact: selectedAudioInput } } : {}),
          echoCancellation: advancedAudioFiltering,
          noiseSuppression: advancedAudioFiltering,
          autoGainControl: autoGainControl,
          sampleRate: { ideal: 48000 },
          channelCount: { ideal: 1 },
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (runId !== micTestGenRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      const ctx = createVoiceAudioContext() || new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;

      let chainCleanup = null;
      try {
        const chain = await buildMicDspChain(ctx, source, {
          aiNoiseSuppression: true,
          noiseSuppressionMode,
          noiseGateThreshold,
          antiStaticFilter,
          inputVolume,
        });
        if (runId !== micTestGenRef.current) {
          chain.cleanup?.();
          stream.getTracks().forEach(t => t.stop());
          ctx.close().catch(() => {});
          return;
        }
        chainCleanup = chain.cleanup;
        chain.outputNode.connect(analyser);
      } catch {
        source.connect(analyser);
      }

      testAudioCtxRef.current = { stream, ctx, analyser, chainCleanup };
      setIsTestingMic(true);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const poll = () => {
        if (!testAudioCtxRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setMicVolumeLevel(normalized);

        testAnimFrameRef.current = requestAnimationFrame(poll);
      };

      poll();
    } catch (err) {
      console.warn('Mic test error:', err);
    }
  };

  // Avatar File Upload via Supabase Storage
  const handleAvatarFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Geçersiz dosya formatı', {
        description: 'Lütfen bir resim dosyası seçin (PNG, JPG, WebP veya GIF).',
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Dosya çok büyük', {
        description: 'Profil fotoğrafı boyutu en fazla 10MB olmalıdır.',
      });
      return;
    }

    let toastId = null;
    try {
      setIsUploadingAvatar(true);
      toastId = toast.loading('Profil fotoğrafı yükleniyor...');
      const targetUserId = authUser?.id || (profile.id !== 'you' ? profile.id : null);
      if (!targetUserId) {
        throw new Error('Oturum açmış kullanıcı kimliği bulunamadı.');
      }
      const prevAvatarUrl = profile?.avatar_url || profile?.avatar || avatarInput || '';
      const uploadedUrl = await uploadAvatarFile(file, targetUserId);
      setAvatarInput(uploadedUrl);
      await updateProfile({ avatar: uploadedUrl, avatar_url: uploadedUrl }, targetUserId);
      if (prevAvatarUrl && prevAvatarUrl !== uploadedUrl) {
        dbService.deleteStorageObjectByUrl('avatars', prevAvatarUrl);
      }
      if (toastId) toast.dismiss(toastId);
      toastId = null;
      toast.success('Profil fotoğrafı güncellendi!');
    } catch (err) {
      if (toastId) toast.dismiss(toastId);
      toastId = null;
      toast.error('Fotoğraf yüklenemedi', {
        description: err.message || 'Lütfen tekrar deneyin.',
      });
    } finally {
      if (toastId) toast.dismiss(toastId);
      setIsUploadingAvatar(false);
      if (avatarFileInputRef.current) avatarFileInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      const targetUserId = authUser?.id || (profile.id !== 'you' ? profile.id : null);
      if (!targetUserId) return;
      const prevAvatarUrl = profile?.avatar_url || profile?.avatar || avatarInput || '';
      setAvatarInput('');
      await updateProfile({ avatar: '', avatar_url: '' }, targetUserId);
      if (prevAvatarUrl) {
        dbService.deleteStorageObjectByUrl('avatars', prevAvatarUrl);
      }
      toast.success('Profil fotoğrafı kaldırıldı');
    } catch (err) {
      toast.error('Fotoğraf kaldırılamadı', { description: err.message });
    }
  };

  const handleSaveProfile = async (e) => {
    e?.preventDefault();
    let toastId = null;
    try {
      setIsSavingProfile(true);
      toastId = toast.loading('Bilgiler kaydediliyor...');
      const targetUserId = authUser?.id || (profile.id !== 'you' ? profile.id : null);
      if (!targetUserId) {
        throw new Error('Oturum açmış kullanıcı kimliği bulunamadı.');
      }

      const cleanUsername = (usernameInput || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '') || profile.username || 'user';
      const cleanDisplayName = displayNameInput.trim() || cleanUsername;

      // 1. If email changed, update email
      const cleanEmail = emailInput.trim();
      if (cleanEmail && cleanEmail !== authUser?.email) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
          throw new Error('Lütfen geçerli bir e-posta adresi giriniz.');
        }
        const emailRes = await updateEmail?.(cleanEmail);
        if (emailRes && !emailRes.success) {
          throw emailRes.error || new Error('E-posta güncellenemedi.');
        }
      }

      // 2. Update profile in database & local state
      const effectiveAvatar = avatarInput.trim() || authUserAvatar || profile?.avatar_url || profile?.avatar || '';
      await updateProfile({
        name: cleanDisplayName,
        display_name: cleanDisplayName,
        username: cleanUsername,
        avatar: effectiveAvatar,
        avatar_url: effectiveAvatar,
      }, targetUserId);

      if (toastId) toast.dismiss(toastId);
      toastId = null;

      setSavedSuccess(true);
      setIsEditingUsername(false);
      setIsEditingEmail(false);
      setIsEditingDisplayName(false);
      toast.success('Hesap bilgileri başarıyla kaydedildi!');
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      if (toastId) toast.dismiss(toastId);
      toastId = null;
      toast.error('Güncelleme başarısız', { description: err.message });
    } finally {
      if (toastId) toast.dismiss(toastId);
      setIsSavingProfile(false);
    }
  };

  const handleSavePassword = async (e) => {
    e?.preventDefault();
    if (!newPassword) {
      toast.error('Lütfen yeni şifrenizi girin.');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Şifre çok kısa', { description: 'Şifreniz en az 6 karakter olmalıdır.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Şifreler eşleşmiyor', { description: 'Girdiğiniz iki şifre birbiriyle uyuşmuyor.' });
      return;
    }

    try {
      setIsUpdatingPassword(true);
      const res = await updatePassword?.(newPassword);
      if (res && !res.success) {
        throw res.error || new Error('Şifre güncellenemedi.');
      }
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess(true);
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err) {
      toast.error('Şifre güncellenemedi', { description: err.message });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const playSpeakerTestSound = () => {
    sounds.playTestTone();
  };

  const handleClose = useCallback(() => {
    stopMicTest();
    stopPttRecording();
    closeSettings();
  }, [closeSettings, stopMicTest, stopPttRecording]);

  // ESC key listener to close fullscreen settings (paused while recording a PTT keybind)
  useEffect(() => {
    if (!isSettingsOpen || isPttRecordingActive) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen, isPttRecordingActive, handleClose]);

  if (!isSettingsOpen) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 top-8 z-40 bg-[#08080a] voys-glass-settings flex w-full text-gray-200 select-none animate-in fade-in duration-150">
      {/* Left Category Sidebar */}
      <div className="w-60 md:w-64 border-r border-white/5 bg-[#0c0c0e] voys-glass-settings-sidebar p-3.5 flex flex-col justify-between flex-shrink-0">
        <div className="flex flex-col space-y-1">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 py-1.5 mb-1">
            Kullanıcı Ayarları
          </div>

          {/* 1. Hesap */}
          <button
            type="button"
            onClick={() => setSettingsTab('account')}
            className={`w-full flex items-center space-x-2.5 px-3.5 py-2.5 text-xs font-semibold rounded-xl transition ${
              activeTab === 'account'
                ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <User size={16} className={activeTab === 'account' ? 'text-indigo-400' : 'text-gray-500'} />
            <span>Hesap</span>
          </button>

          {/* 2. Özelleştirme */}
          <button
            type="button"
            onClick={() => setSettingsTab('customization')}
            className={`w-full flex items-center space-x-2.5 px-3.5 py-2.5 text-xs font-semibold rounded-xl transition ${
              activeTab === 'customization'
                ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Palette size={16} className={activeTab === 'customization' ? 'text-indigo-400' : 'text-gray-500'} />
            <span>Özelleştirme</span>
          </button>

          {/* 3. Aygıt */}
          <button
            type="button"
            onClick={() => setSettingsTab('devices')}
            className={`w-full flex items-center space-x-2.5 px-3.5 py-2.5 text-xs font-semibold rounded-xl transition ${
              activeTab === 'devices'
                ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Headphones size={16} className={activeTab === 'devices' ? 'text-indigo-400' : 'text-gray-500'} />
            <span>Aygıt</span>
          </button>

          {/* 4. Dil ve Saat */}
          <button
            type="button"
            onClick={() => setSettingsTab('language_time')}
            className={`w-full flex items-center space-x-2.5 px-3.5 py-2.5 text-xs font-semibold rounded-xl transition ${
              activeTab === 'language_time'
                ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Clock size={16} className={activeTab === 'language_time' ? 'text-indigo-400' : 'text-gray-500'} />
            <span>Dil ve Saat</span>
          </button>

          {/* 5. Sistem & İzleme (Yalnızca Lyring Yönetici Hesabı) */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setSettingsTab('system_monitor')}
              className={`w-full flex items-center space-x-2.5 px-3.5 py-2.5 text-xs font-semibold rounded-xl transition ${
                activeTab === 'system_monitor'
                  ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40 shadow-sm'
                  : 'text-amber-300/75 hover:text-amber-200 hover:bg-amber-500/10 border border-transparent'
              }`}
            >
              <Activity size={16} className={activeTab === 'system_monitor' ? 'text-amber-300' : 'text-amber-400/70'} />
              <span>Sistem &amp; İzleme</span>
            </button>
          )}
        </div>

        {/* Sol Alt: Sohbetlere Dön */}
        <div className="pt-3 border-t border-white/5">
          <button
            type="button"
            onClick={handleClose}
            className="w-full flex items-center space-x-2.5 px-3.5 py-2.5 text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition cursor-pointer select-none group"
            title="Sohbetlere Dön (ESC)"
          >
            <ArrowLeft size={16} className="text-gray-400 group-hover:text-white transition group-hover:-translate-x-0.5" />
            <span>Sohbetlere Dön</span>
            <span className="ml-auto text-[10px] text-gray-500 font-normal px-1.5 py-0.5 rounded border border-white/10">ESC</span>
          </button>
        </div>
      </div>

      {/* Right Scrollable Tab Panel */}
      <div className="flex-1 h-full overflow-y-auto bg-[#08080a] relative">
        <div className={`${activeTab === 'system_monitor' ? 'max-w-5xl' : 'max-w-3xl'} mx-auto px-6 md:px-10 py-8 space-y-6`}>
          {/* TAB 1: HESAP */}
          {activeTab === 'account' && (
            <div className="space-y-6">
              {/* Header: Hesap */}
              <div className="pb-4 border-b border-white/[0.08] flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Hesap</h2>
                  <p className="text-xs text-gray-400 mt-1">Kişisel profilinizi, kullanıcı bilgilerinizi ve şifre güvenliğinizi yönetin.</p>
                </div>
              </div>

              {/* Bölüm 1: Profil Fotoğrafı */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-200 uppercase tracking-wider block">
                    PROFİL FOTOĞRAFI
                  </label>
                  {avatarInput && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="text-[11px] text-red-400 hover:text-red-300 flex items-center space-x-1 transition font-medium cursor-pointer"
                    >
                      <Trash2 size={12} />
                      <span>Fotoğrafı Kaldır</span>
                    </button>
                  )}
                </div>

                <div className="p-4 bg-[#111214] border border-white/10 rounded-xl flex flex-col sm:flex-row items-center gap-5">
                  <input
                    ref={avatarFileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handleAvatarFileChange}
                    className="hidden"
                  />
                  <div 
                    onClick={() => avatarFileInputRef.current?.click()}
                    className="relative group w-20 h-20 rounded-full overflow-hidden border-2 border-white/10 hover:border-[#8B51FF] bg-black/40 flex flex-col items-center justify-center cursor-pointer transition flex-shrink-0"
                    title="Fotoğraf değiştirmek için tıklayın"
                  >
                    {avatarInput ? (
                      <img 
                        src={avatarInput} 
                        alt="Avatar Önizleme" 
                        className="w-full h-full object-cover group-hover:opacity-40 transition" 
                      />
                    ) : (
                      <User size={30} className="text-gray-400 group-hover:scale-110 transition" />
                    )}
                    <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 bg-black/60 transition text-white text-[10px] font-semibold">
                      <Camera size={16} className="mb-0.5" />
                      <span>Değiştir</span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-1.5 text-center sm:text-left">
                    <p className="text-xs text-gray-200 font-medium">
                      Kişisel profil görselinizi bilgisayarınızdan seçin.
                    </p>
                    <p className="text-[11px] text-gray-400">
                      Önerilen formatlar: PNG, JPG, WebP veya GIF (Maks. 5MB).
                    </p>
                    <div className="pt-1">
                      <button
                        type="button"
                        disabled={isUploadingAvatar}
                        onClick={() => avatarFileInputRef.current?.click()}
                        className="inline-flex items-center space-x-2 px-3.5 py-1.5 bg-[#8B51FF] hover:bg-[#773BF5] text-white rounded-lg text-xs font-semibold shadow transition active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                        {isUploadingAvatar ? (
                          <>
                            <Loader2 size={13} className="animate-spin text-white" />
                            <span>Yükleniyor...</span>
                          </>
                        ) : (
                          <>
                            <Upload size={13} />
                            <span>Bilgisayardan Fotoğraf Yükle</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bölüm 2: Hesap Bilgileri */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-200 uppercase tracking-wider block">
                    HESAP BİLGİLERİ
                  </label>
                </div>

                <form onSubmit={handleSaveProfile} className="p-4 bg-[#111214] border border-white/10 rounded-xl space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Kullanıcı Adı */}
                    <div>
                      <label className="text-xs font-semibold text-gray-200 block mb-1.5">
                        Kullanıcı Adı
                      </label>
                      <div className="relative">
                        <span className={`absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-xs transition ${
                          isEditingUsername ? 'text-gray-400' : 'text-gray-600'
                        }`}>@</span>
                        <input
                          ref={usernameInputRef}
                          type="text"
                          readOnly={!isEditingUsername}
                          value={usernameInput}
                          onChange={(e) => setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                          className={`w-full rounded-lg pl-8 pr-9 py-2.5 text-xs font-mono transition ${
                            isEditingUsername
                              ? 'bg-[#1e1f22] text-white border border-[#8B51FF] ring-2 ring-[#8B51FF]/20 focus:outline-none'
                              : 'bg-[#161719]/80 text-gray-400 border border-white/5 cursor-not-allowed select-none opacity-60'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={toggleEditUsername}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white transition cursor-pointer"
                          title={isEditingUsername ? 'Kilitle' : 'Kullanıcı Adını Değiştir'}
                        >
                          <Pencil size={13} className={isEditingUsername ? 'text-indigo-400' : 'text-gray-400'} />
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1">Küçük harf, rakam ve alt çizgi içerebilir</p>
                    </div>

                    {/* E-posta */}
                    <div>
                      <label className="text-xs font-semibold text-gray-200 block mb-1.5">
                        E-posta Adresi
                      </label>
                      <div className="relative">
                        <input
                          ref={emailInputRef}
                          type="email"
                          readOnly={!isEditingEmail}
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          className={`w-full rounded-lg pl-3.5 pr-9 py-2.5 text-xs transition ${
                            isEditingEmail
                              ? 'bg-[#1e1f22] text-white border border-[#8B51FF] ring-2 ring-[#8B51FF]/20 focus:outline-none'
                              : 'bg-[#161719]/80 text-gray-400 border border-white/5 cursor-not-allowed select-none opacity-60'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={toggleEditEmail}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white transition cursor-pointer"
                          title={isEditingEmail ? 'Kilitle' : 'E-posta Adresini Değiştir'}
                        >
                          <Pencil size={13} className={isEditingEmail ? 'text-indigo-400' : 'text-gray-400'} />
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1">Hesap girişiniz ve bildirimler için kullanılır</p>
                    </div>

                    {/* Görünen İsim */}
                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold text-gray-200 block mb-1.5">
                        Görünen İsim (Takma Ad)
                      </label>
                      <div className="relative">
                        <input
                          ref={displayNameInputRef}
                          type="text"
                          readOnly={!isEditingDisplayName}
                          value={displayNameInput}
                          onChange={(e) => setDisplayNameInput(e.target.value)}
                          className={`w-full rounded-lg pl-3.5 pr-9 py-2.5 text-xs transition ${
                            isEditingDisplayName
                              ? 'bg-[#1e1f22] text-white border border-[#8B51FF] ring-2 ring-[#8B51FF]/20 focus:outline-none'
                              : 'bg-[#161719]/80 text-gray-400 border border-white/5 cursor-not-allowed select-none opacity-60'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={toggleEditDisplayName}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white transition cursor-pointer"
                          title={isEditingDisplayName ? 'Kilitle' : 'Görünen İsmi Değiştir'}
                        >
                          <Pencil size={13} className={isEditingDisplayName ? 'text-indigo-400' : 'text-gray-400'} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Bilgileri Kaydet Butonu */}
                  <div className="flex items-center justify-end space-x-3 pt-3 border-t border-white/5">
                    {savedSuccess && (
                      <span className="text-xs text-emerald-400 flex items-center gap-1.5 font-semibold">
                        <Check size={14} /> Hesap Bilgileri Kaydedildi!
                      </span>
                    )}
                    <button
                      type="submit"
                      disabled={isSavingProfile || isUploadingAvatar}
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#8B51FF] hover:bg-[#773BF5] rounded-lg shadow transition active:scale-95 flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
                    >
                      {isSavingProfile ? (
                        <>
                          <Loader2 size={13} className="animate-spin text-white" />
                          <span>Kaydediliyor...</span>
                        </>
                      ) : (
                        <span>Hesap Bilgilerini Kaydet</span>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Bölüm 3: Şifre ve Güvenlik */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-gray-200 uppercase tracking-wider block">
                  ŞİFRE VE GÜVENLİK
                </label>

                <form onSubmit={handleSavePassword} className="p-4 bg-[#111214] border border-white/10 rounded-xl space-y-4">
                  <p className="text-xs text-gray-400">
                    Hesabınızı güvende tutmak için en az 6 karakterden oluşan yeni ve güçlü bir şifre belirleyin.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Yeni Şifre */}
                    <div>
                      <label className="text-xs font-semibold text-gray-200 mb-1.5 flex items-center justify-between">
                        <span>Yeni Şifre</span>
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-gray-400 hover:text-white text-[11px] flex items-center space-x-1 cursor-pointer"
                        >
                          {showPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                          <span>{showPassword ? 'Gizle' : 'Göster'}</span>
                        </button>
                      </label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-[#1e1f22] border border-black/40 rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#8B51FF] transition"
                      />
                    </div>

                    {/* Yeni Şifre Tekrar */}
                    <div>
                      <label className="text-xs font-semibold text-gray-200 block mb-1.5">
                        Yeni Şifre (Tekrar)
                      </label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-[#1e1f22] border border-black/40 rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#8B51FF] transition"
                      />
                    </div>
                  </div>

                  {/* Şifreyi Güncelle Butonu */}
                  <div className="flex items-center justify-end space-x-3 pt-3 border-t border-white/5">
                    {passwordSuccess && (
                      <span className="text-xs text-emerald-400 flex items-center gap-1.5 font-semibold">
                        <Check size={14} /> Şifre Başarıyla Güncellendi!
                      </span>
                    )}
                    <button
                      type="submit"
                      disabled={isUpdatingPassword || !newPassword}
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#8B51FF] hover:bg-[#773BF5] rounded-lg shadow transition active:scale-95 flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
                    >
                      {isUpdatingPassword ? (
                        <>
                          <Loader2 size={13} className="animate-spin text-white" />
                          <span>Güncelleniyor...</span>
                        </>
                      ) : (
                        <>
                          <KeyRound size={13} />
                          <span>Şifreyi Güncelle</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Sade Çıkış Yap Aksiyonu */}
              <div className="pt-4 border-t border-white/[0.08] flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    onLogout?.();
                  }}
                  className="px-4 py-2 text-xs font-semibold text-red-400 hover:text-white bg-red-500/10 hover:bg-red-600 border border-red-500/30 hover:border-red-600 rounded-lg transition active:scale-95 inline-flex items-center space-x-2 cursor-pointer"
                >
                  <LogOut size={14} />
                  <span>Çıkış Yap</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: ÖZELLEŞTİRME */}
          {activeTab === 'customization' && (
            <div className="space-y-6">
              {/* Header: Özelleştirme */}
              <div className="pb-4 border-b border-white/[0.08] flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Özelleştirme</h2>
                  <p className="text-xs text-gray-400 mt-1">Voys arayüzü için tema ve görünüm tercihlerinizi yapılandırın.</p>
                </div>
              </div>

              {/* Section: STANDART TEMA */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-gray-200 uppercase tracking-wider block">
                  STANDART TEMA
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* KOYU TEMA KARTI */}
                  <div
                    onClick={() => {
                      updateChatSetting('theme', 'dark');
                      toast.success('Koyu tema aktif edildi');
                    }}
                    className={`group relative p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      (chatSettings?.theme || 'dark') === 'dark'
                        ? 'border-[#8B51FF] bg-[#1a1b24] shadow-[0_0_20px_rgba(139,81,255,0.15)] ring-1 ring-[#8B51FF]/50'
                        : isLight
                          ? 'border-black/10 bg-[#f2f3f5] hover:border-black/20 hover:bg-[#ebedef]'
                          : 'border-white/10 bg-[#111214] hover:border-white/20 hover:bg-[#16171c]'
                    }`}
                  >
                    {/* Mock UI Preview - Dark Mode */}
                    <div className="w-full h-32 rounded-xl bg-[#0e0e12] border border-white/10 p-2.5 flex flex-col justify-between overflow-hidden shadow-inner mb-4 select-none">
                      {/* Window title dots */}
                      <div className="flex items-center space-x-1.5 pb-2 border-b border-white/5">
                        <div className="w-2 h-2 rounded-full bg-rose-500/80" />
                        <div className="w-2 h-2 rounded-full bg-amber-500/80" />
                        <div className="w-2 h-2 rounded-full bg-emerald-500/80" />
                        <div className="h-1.5 w-16 bg-white/10 rounded-full ml-2" />
                      </div>

                      {/* Mock client body */}
                      <div className="flex-1 flex space-x-2 pt-2 min-h-0">
                        {/* Mini sidebar */}
                        <div className="w-1/3 bg-[#16171b] rounded-lg p-1.5 space-y-1.5 border border-white/5">
                          <div className="h-2 w-12 bg-white/20 rounded-full" />
                          <div className="h-1.5 w-full bg-white/10 rounded-full" />
                          <div className="h-1.5 w-3/4 bg-white/10 rounded-full" />
                          <div className="h-1.5 w-4/5 bg-indigo-500/40 rounded-full" />
                        </div>

                        {/* Mini chat area */}
                        <div className="flex-1 bg-[#121317] rounded-lg p-1.5 flex flex-col justify-between border border-white/5">
                          <div className="space-y-1.5">
                            <div className="flex items-center space-x-1">
                              <div className="w-3 h-3 rounded-full bg-indigo-500/60" />
                              <div className="h-1.5 w-10 bg-white/30 rounded-full" />
                            </div>
                            <div className="h-2 w-4/5 bg-[#252730] rounded-md" />
                            <div className="h-2 w-3/5 bg-[#8B51FF]/40 rounded-md ml-auto" />
                          </div>
                          <div className="h-3 w-full bg-[#1b1c22] rounded border border-white/5 flex items-center px-1">
                            <div className="h-1 w-12 bg-white/20 rounded-full" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card footer / Selection Info */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition ${
                          (chatSettings?.theme || 'dark') === 'dark'
                            ? 'bg-[#8B51FF] text-white shadow-md'
                            : isLight
                              ? 'bg-black/5 text-gray-600 group-hover:text-black'
                              : 'bg-white/5 text-gray-400 group-hover:text-white'
                        }`}>
                          <Moon size={16} />
                        </div>
                        <div>
                          <div className={`text-xs font-bold flex items-center space-x-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                            <span>Koyu Tema</span>
                            {(chatSettings?.theme || 'dark') === 'dark' && (
                              <span className="text-[10px] text-indigo-400 bg-indigo-500/20 border border-indigo-500/30 px-1.5 py-0.2 rounded font-medium">
                                Aktif
                              </span>
                            )}
                          </div>
                          <div className={`text-[10px] mt-0.5 ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>Klasik koyu gece modu</div>
                        </div>
                      </div>

                      {/* Custom Radio Button */}
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition ${
                        (chatSettings?.theme || 'dark') === 'dark'
                          ? 'border-[#8B51FF] bg-[#8B51FF]'
                          : isLight
                            ? 'border-black/30 group-hover:border-black/50'
                            : 'border-white/30 group-hover:border-white/50'
                      }`}>
                        {(chatSettings?.theme || 'dark') === 'dark' && (
                          <Check size={12} className="text-white stroke-[3]" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* AÇIK TEMA KARTI */}
                  <div
                    onClick={() => {
                      updateChatSetting('theme', 'light');
                      toast.success('Açık tema aktif edildi');
                    }}
                    className={`group relative p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      chatSettings?.theme === 'light'
                        ? isLight
                          ? 'border-[#8B51FF] bg-white shadow-[0_0_20px_rgba(139,81,255,0.15)] ring-1 ring-[#8B51FF]/50'
                          : 'border-[#8B51FF] bg-[#1a1b24] shadow-[0_0_20px_rgba(139,81,255,0.15)] ring-1 ring-[#8B51FF]/50'
                        : isLight
                          ? 'border-black/10 bg-[#f2f3f5] hover:border-black/20 hover:bg-[#ebedef]'
                          : 'border-white/10 bg-[#111214] hover:border-white/20 hover:bg-[#16171c]'
                    }`}
                  >
                    {/* Mock UI Preview - Light Mode */}
                    <div className="w-full h-32 rounded-xl bg-[#f2f3f5] border border-black/10 p-2.5 flex flex-col justify-between overflow-hidden shadow-inner mb-4 select-none">
                      {/* Window title dots */}
                      <div className="flex items-center space-x-1.5 pb-2 border-b border-black/5">
                        <div className="w-2 h-2 rounded-full bg-rose-400" />
                        <div className="w-2 h-2 rounded-full bg-amber-400" />
                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        <div className="h-1.5 w-16 bg-black/10 rounded-full ml-2" />
                      </div>

                      {/* Mock client body */}
                      <div className="flex-1 flex space-x-2 pt-2 min-h-0">
                        {/* Mini sidebar */}
                        <div className="w-1/3 bg-[#e3e5e8] rounded-lg p-1.5 space-y-1.5 border border-black/5">
                          <div className="h-2 w-12 bg-black/30 rounded-full" />
                          <div className="h-1.5 w-full bg-black/15 rounded-full" />
                          <div className="h-1.5 w-3/4 bg-black/15 rounded-full" />
                          <div className="h-1.5 w-4/5 bg-indigo-500/50 rounded-full" />
                        </div>

                        {/* Mini chat area */}
                        <div className="flex-1 bg-white rounded-lg p-1.5 flex flex-col justify-between border border-black/5 shadow-sm">
                          <div className="space-y-1.5">
                            <div className="flex items-center space-x-1">
                              <div className="w-3 h-3 rounded-full bg-indigo-600/70" />
                              <div className="h-1.5 w-10 bg-black/40 rounded-full" />
                            </div>
                            <div className="h-2 w-4/5 bg-[#e8eaed] rounded-md" />
                            <div className="h-2 w-3/5 bg-[#8B51FF]/40 rounded-md ml-auto" />
                          </div>
                          <div className="h-3 w-full bg-[#f2f3f5] rounded border border-black/5 flex items-center px-1">
                            <div className="h-1 w-12 bg-black/20 rounded-full" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card footer / Selection Info */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition ${
                          chatSettings?.theme === 'light'
                            ? 'bg-[#8B51FF] text-white shadow-md'
                            : isLight
                              ? 'bg-black/5 text-gray-600 group-hover:text-amber-500'
                              : 'bg-white/5 text-gray-400 group-hover:text-amber-400'
                        }`}>
                          <Sun size={16} />
                        </div>
                        <div>
                          <div className={`text-xs font-bold flex items-center space-x-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                            <span>Açık Tema</span>
                            {chatSettings?.theme === 'light' && (
                              <span className="text-[10px] text-indigo-400 bg-indigo-500/20 border border-indigo-500/30 px-1.5 py-0.2 rounded font-medium">
                                Aktif
                              </span>
                            )}
                          </div>
                          <div className={`text-[10px] mt-0.5 ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>Aydınlık ve ferah standart mod</div>
                        </div>
                      </div>

                      {/* Custom Radio Button */}
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition ${
                        chatSettings?.theme === 'light'
                          ? 'border-[#8B51FF] bg-[#8B51FF]'
                          : isLight
                            ? 'border-black/30 group-hover:border-black/50'
                            : 'border-white/30 group-hover:border-white/50'
                      }`}>
                        {chatSettings?.theme === 'light' && (
                          <Check size={12} className="text-white stroke-[3]" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: PENCERE ŞEFFAFLIĞI */}
              <div className="space-y-4 pt-4 border-t border-white/10">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider block opacity-90">
                    PENCERE ŞEFFAFLIĞI
                  </label>
                  <p className="text-xs opacity-60 mt-0.5">
                    Masaüstü penceresinin arka plan saydamlığını ve cam bulanıklık (blur) yoğunluğunu ayarlayın.
                  </p>
                </div>

                {/* İnce Ayar Kaydırıcısı (Slider) */}
                <div className={`p-4 rounded-xl space-y-3 border ${
                  isLight ? 'bg-[#f8f9fa] border-black/10' : 'bg-[#111214] border-white/10'
                }`}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold flex items-center gap-2 opacity-80">
                      <Sliders size={14} className="text-indigo-500" />
                      Hassas Opaklık Kaydırıcısı
                    </span>
                    <span className="font-mono text-indigo-500 font-bold">
                      %{chatSettings?.windowOpacity ?? 100}
                    </span>
                  </div>

                  <input
                    type="range"
                    min="25"
                    max="100"
                    step="5"
                    value={chatSettings?.windowOpacity ?? 100}
                    onChange={(e) => updateChatSetting('windowOpacity', Number(e.target.value))}
                    className="w-full accent-indigo-500 h-1.5 bg-black/10 dark:bg-white/10 rounded-lg appearance-none cursor-pointer"
                  />

                  <div className="flex justify-between text-[10px] opacity-50 font-mono">
                    <span>%25 (Ultra Cam)</span>
                    <span>%50 (Dengeli)</span>
                    <span>%75 (Hafif)</span>
                    <span>%100 (Katı Opak)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AYGIT */}
          {activeTab === 'devices' && (
            <div className="space-y-6">
              {/* Header: Aygıt */}
              <div className="pb-4 border-b border-white/[0.08] flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Aygıt</h2>
                  <p className="text-xs text-gray-400 mt-1">Ses giriş ve çıkış cihazlarınızı yapılandırın ve test edin.</p>
                </div>
                <button
                  type="button"
                  onClick={refreshDevices}
                  className="flex items-center space-x-1.5 text-xs text-gray-400 hover:text-white transition font-medium px-3 py-1.5 rounded-lg hover:bg-white/5 border border-white/5 cursor-pointer"
                  title="Aygıt Listesini Yenile"
                >
                  <RefreshCw size={13} />
                  <span>Aygıtları Yenile</span>
                </button>
              </div>

              {/* 2 Sütunlu Izgara: Mikrofon & Hoparlör */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                {/* Sol Sütun: Mikrofon */}
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-200 block mb-2">Mikrofon</label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none flex items-center">
                        <Mic size={16} />
                      </div>
                      <select
                        value={selectedAudioInput}
                        onChange={(e) => changeAudioInput(e.target.value)}
                        className="w-full bg-[#111214] hover:bg-[#1e1f22] text-gray-200 text-xs rounded-lg pl-10 pr-9 py-2.5 appearance-none border border-black/40 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition cursor-pointer truncate"
                      >
                        {audioInputs.length === 0 ? (
                          <option value="">Mikrofon algılanmadı (İzin veriniz)</option>
                        ) : (
                          audioInputs.map((input) => (
                            <option key={input.deviceId} value={input.deviceId} className="bg-[#1e1f22] text-white">
                              {input.label || `Mikrofon (${input.deviceId.slice(0, 8)})`}
                            </option>
                          ))
                        )}
                      </select>
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none flex items-center">
                        <ChevronDown size={16} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-semibold text-gray-200">Mikrofon Ses Seviyesi</label>
                      <span className="text-xs text-gray-400 font-mono">{inputVolume}%</span>
                    </div>
                    <div className="relative flex items-center py-1">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={inputVolume}
                        onChange={(e) => changeInputVolume(Number(e.target.value))}
                        className="w-full h-1.5 rounded-lg appearance-none cursor-pointer voice-slider"
                        style={{
                          background: `linear-gradient(to right, #8B51FF ${inputVolume}%, #232428 ${inputVolume}%)`
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Sağ Sütun: Hoparlör */}
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-gray-200">Hoparlör</label>
                      <button
                        type="button"
                        onClick={playSpeakerTestSound}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 transition font-medium"
                        title="Test Sesi Çal"
                      >
                        <Play size={10} />
                        <span>Test Sesi</span>
                      </button>
                    </div>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none flex items-center">
                        <Headphones size={16} />
                      </div>
                      <select
                        value={selectedAudioOutput}
                        onChange={(e) => changeAudioOutput(e.target.value)}
                        className="w-full bg-[#111214] hover:bg-[#1e1f22] text-gray-200 text-xs rounded-lg pl-10 pr-9 py-2.5 appearance-none border border-black/40 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition cursor-pointer truncate"
                      >
                        {audioOutputs.length === 0 ? (
                          <option value="">Varsayılan Sistem Hoparlörü</option>
                        ) : (
                          audioOutputs.map((output) => (
                            <option key={output.deviceId} value={output.deviceId} className="bg-[#1e1f22] text-white">
                              {output.label || `Hoparlör (${output.deviceId.slice(0, 8)})`}
                            </option>
                          ))
                        )}
                      </select>
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none flex items-center">
                        <ChevronDown size={16} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-semibold text-gray-200">Hoparlör Ses Seviyesi</label>
                      <div className="flex items-center space-x-2">
                        {outputVolume !== 100 && (
                          <button
                            type="button"
                            onClick={() => changeOutputVolume(100)}
                            className="text-[10px] text-gray-400 hover:text-white underline transition cursor-pointer"
                            title="Varsayılana Sıfırla (%100)"
                          >
                            %100
                          </button>
                        )}
                        <span
                          className={`text-xs font-mono font-semibold ${
                            outputVolume > 100 ? 'text-amber-400' : 'text-gray-400'
                          }`}
                        >
                          {outputVolume}%
                        </span>
                      </div>
                    </div>
                    <div className="relative flex items-center py-1">
                      <span
                        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[1.5px] h-3 bg-white/30 rounded-full z-0"
                        aria-hidden="true"
                      />
                      <input
                        type="range"
                        min="0"
                        max={MAX_VOLUME_PERCENT}
                        value={outputVolume}
                        onChange={(e) => changeOutputVolume(Number(e.target.value))}
                        className="relative z-10 w-full h-1.5 rounded-lg appearance-none cursor-pointer voice-slider"
                        style={{
                          background: getVolumeSliderFillStyle(
                            outputVolume,
                            MAX_VOLUME_PERCENT,
                            '#8B51FF',
                            '#f59e0b',
                            '#232428'
                          ),
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500 font-mono mt-0.5 select-none">
                      <span>%0</span>
                      <span>%100</span>
                      <span>%200</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mikrofon Testi Satırı (Örnek Ekran Görüntüsü ile Birebir) */}
              <div className="flex items-center space-x-5 pt-2">
                <button
                  type="button"
                  onClick={isTestingMic ? stopMicTest : startMicTest}
                  className={`px-5 py-2.5 rounded-lg text-xs font-semibold transition flex-shrink-0 shadow-sm ${
                    isTestingMic 
                      ? 'bg-red-500 hover:bg-red-600 text-white' 
                      : 'bg-[#8B51FF] hover:bg-[#773BF5] text-white active:scale-[0.98]'
                  }`}
                >
                  {isTestingMic ? 'Testi Durdur' : 'Mikrofon Testi'}
                </button>

                <div className="flex-1 flex items-center h-8 space-x-[3px] overflow-hidden select-none">
                  {Array.from({ length: 48 }).map((_, index) => {
                    const active = isTestingMic && micVolumeLevel >= ((index + 1) / 48) * 100;
                    return (
                      <div
                        key={index}
                        className={`flex-1 h-5 rounded-full transition-colors duration-75 ${
                          active ? 'bg-[#23a55a]' : 'bg-[#232428]'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Giriş Modu & Bas-Konuş (Push-to-Talk) */}
              <div className="pt-6 border-t border-white/[0.08] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-bold text-gray-200 uppercase tracking-wider block">
                      GİRİŞ MODU
                    </label>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Sesinizin karşı tarafa ne zaman iletileceğini seçin.
                    </p>
                  </div>

                  {inputMode === 'ptt' && (
                    <span
                      className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                        isPttActive
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isPttActive ? 'bg-emerald-400' : 'bg-indigo-400'
                        }`}
                      />
                      <span>{isPttActive ? 'Konuşma Aktif (İletiliyor)' : `Bas-Konuş Hazır [${formatShortcutLabel(pttKey)}]`}</span>
                    </span>
                  )}
                </div>

                {/* Mod Seçim Kartları */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      stopPttRecording();
                      changeInputMode('open');
                      toast.success('Giriş modu: Ses Aktivitesi (Açık Mikrofon)');
                    }}
                    className={`flex items-start space-x-3 p-4 rounded-xl border text-left transition cursor-pointer ${
                      inputMode === 'open'
                        ? 'bg-indigo-600/15 border-indigo-500/60 shadow-[0_0_20px_rgba(139,81,255,0.12)]'
                        : 'bg-[#121216] border-white/[0.08] hover:border-white/20 hover:bg-[#16161c]'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        inputMode === 'open' ? 'bg-indigo-500 text-white' : 'bg-white/5 text-gray-400'
                      }`}
                    >
                      <Radio size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-white">Ses Aktivitesi</span>
                        {inputMode === 'open' && <Check size={15} className="text-indigo-400 flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                        Mikrofon açık kalır ve konuştuğunuz anda sesi otomatik iletir.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      changeInputMode('ptt');
                      toast.success(`Bas-Konuş aktif edildi (${formatShortcutLabel(pttKey)})`);
                    }}
                    className={`flex items-start space-x-3 p-4 rounded-xl border text-left transition cursor-pointer ${
                      inputMode === 'ptt'
                        ? 'bg-indigo-600/15 border-indigo-500/60 shadow-[0_0_20px_rgba(139,81,255,0.12)]'
                        : 'bg-[#121216] border-white/[0.08] hover:border-white/20 hover:bg-[#16161c]'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        inputMode === 'ptt' ? 'bg-indigo-500 text-white' : 'bg-white/5 text-gray-400'
                      }`}
                    >
                      <Keyboard size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-white">Bas-Konuş</span>
                        {inputMode === 'ptt' && <Check size={15} className="text-indigo-400 flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                        Mikrofon yalnızca seçtiğiniz tuşa basılı tuttuğunuzda açılır.
                      </p>
                    </div>
                  </button>
                </div>

                {/* Bas-Konuş Kısayol Tuşu Ayarı */}
                {inputMode === 'ptt' && (
                  <div className="p-4 rounded-xl bg-[#101015] border border-white/[0.08] space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <label className="text-xs font-bold text-gray-200 uppercase tracking-wider block">
                          KISAYOL TUŞU
                        </label>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Klavye tuşu, tuş kombinasyonu (örn. Alt+V) veya Mouse yan tuşu (Mouse 4 / 5) atayabilirsiniz.
                        </p>
                      </div>

                      {pttKey !== DEFAULT_PTT_KEY && (
                        <button
                          type="button"
                          onClick={() => {
                            stopPttRecording();
                            changePttKey(DEFAULT_PTT_KEY);
                            toast.success(`Varsayılan tuşa sıfırlandı: ${formatShortcutLabel(DEFAULT_PTT_KEY)}`);
                          }}
                          className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition self-start sm:self-auto flex-shrink-0 cursor-pointer"
                        >
                          <RotateCcw size={12} />
                          <span>Varsayılana Sıfırla ({DEFAULT_PTT_KEY})</span>
                        </button>
                      )}
                    </div>

                    {/* Etkileşimli Tuş Atama Kutusu */}
                    <div
                      ref={pttRecorderBoxRef}
                      onClick={() => {
                        if (isRecordingPttKey) {
                          stopPttRecording();
                        } else {
                          pendingSoloModifierRef.current = null;
                          setPendingPttModifiers([]);
                          setIsRecordingPttKey(true);
                        }
                      }}
                      className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-colors cursor-pointer select-none ${
                        isRecordingPttKey
                          ? 'bg-rose-500/10 border-rose-500/60'
                          : isPttActive
                          ? 'bg-emerald-500/10 border-emerald-500/50'
                          : 'bg-[#17171d] border-white/10 hover:border-indigo-500/50'
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <Keyboard
                          size={18}
                          className={
                            isRecordingPttKey
                              ? 'text-rose-400 flex-shrink-0'
                              : isPttActive
                              ? 'text-emerald-400 flex-shrink-0'
                              : 'text-indigo-400 flex-shrink-0'
                          }
                        />
                        {isRecordingPttKey ? (
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-rose-300 block">
                              {pendingPttModifiers.length > 0
                                ? `${pendingPttModifiers.join(' + ')} + ... (veya bırakın)`
                                : 'İstediğiniz klavye tuşuna veya Mouse yan tuşuna basın...'}
                            </span>
                            <span className="text-[11px] text-rose-300/70">İptal etmek için ESC tuşuna basın</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <span className="inline-flex items-center px-3 py-1 rounded-lg bg-[#23242b] border border-white/15 text-sm font-mono font-bold text-white shadow-inner">
                              {formatShortcutLabel(pttKey, { detailed: true })}
                            </span>
                            <span className="text-xs text-gray-400 truncate">
                              Değiştirmek için tıklayın ve tuşa basın
                            </span>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isRecordingPttKey) {
                            stopPttRecording();
                          } else {
                            pendingSoloModifierRef.current = null;
                            setPendingPttModifiers([]);
                            setIsRecordingPttKey(true);
                          }
                        }}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex-shrink-0 cursor-pointer ${
                          isRecordingPttKey
                            ? 'bg-rose-500 hover:bg-rose-600 text-white'
                            : 'bg-[#8B51FF] hover:bg-[#773BF5] text-white'
                        }`}
                      >
                        {isRecordingPttKey ? 'Kaydı Durdur' : 'Tuş Ata'}
                      </button>
                    </div>

                    {/* Hızlı Öneri Tuşları */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-medium text-gray-500 mr-1">Hızlı Seçim:</span>
                      {['Alt', 'CapsLock', 'Alt+V', 'Control+Space', 'F4', 'Mouse4', 'Mouse5'].map((preset) => {
                        const selected = pttKey === preset;
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              stopPttRecording();
                              changePttKey(preset);
                              toast.success(`Bas-Konuş tuşu ayarlandı: ${formatShortcutLabel(preset)}`);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border transition cursor-pointer ${
                              selected
                                ? 'bg-indigo-500/25 text-indigo-200 border-indigo-400/60'
                                : 'bg-white/[0.04] text-gray-300 border-white/10 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            {formatShortcutLabel(preset)}
                          </button>
                        );
                      })}
                    </div>

                    {/* Kapsam & Canlı Çalışma Durumu */}
                    <div
                      className={`text-[11px] px-3 py-2 rounded-lg border flex items-start space-x-2 ${
                        pttStatus?.isTauriGlobal
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                          : 'bg-amber-500/10 border-amber-500/20 text-amber-200/90'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                          pttStatus?.isTauriGlobal ? 'bg-emerald-400' : 'bg-amber-400'
                        }`}
                      />
                      <span>
                        {pttStatus?.isTauriGlobal
                          ? pttStatus?.mode === 'native-global'
                            ? 'Sistem geneli (Oyun İçi) kısayol aktif — Shift veya diğer tuşlara basılıyken de oyunlarda Bas-Konuş çalışır.'
                            : 'Sistem geneli (Global) kısayol aktif — başka bir uygulama veya oyundayken de Bas-Konuş çalışır.'
                          : isTauriEnvironment()
                          ? `Uygulama içi kısayol aktif (${pttStatus?.warning || 'seçilen tuş sistem genelinde yakalanamaz'}). Oyun içinde arka planda da çalışması için Alt+V, Ctrl+Space, CapsLock veya F1–F12 seçebilirsiniz.`
                          : 'Tarayıcı modunda Bas-Konuş, Voys sekmesi aktifken çalışır. Oyun içi arka plan desteği için masaüstü uygulamasını kullanın.'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Ses Efektleri & Bildirim Sesleri */}
              <div className="pt-6 border-t border-white/[0.08] space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block">
                    SES EFEKTLERİ VE BİLDİRİM SESLERİ
                  </label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Bas-Konuş, sesli sohbete katılım, mikrofon butonları, mesaj ve arama seslerini tek tıkla kapatın veya seviyesini ayarlayın.
                  </p>
                </div>

                {/* Master Toggle Card: Tüm Uygulama Ses Efektleri */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={soundEffectsEnabled}
                  onClick={() => {
                    const next = !soundEffectsEnabled;
                    changeSoundEffectsEnabled(next);
                    if (next) {
                      toast.success('Uygulama ses efektleri açıldı');
                    } else {
                      toast.info('Tüm uygulama ses efektleri kapatıldı');
                    }
                  }}
                  className={`w-full flex items-center justify-between gap-4 p-4 rounded-xl border text-left transition cursor-pointer ${
                    !soundEffectsEnabled
                      ? 'bg-rose-500/10 border-rose-500/35 hover:border-rose-500/50'
                      : 'bg-[#121216] border-white/[0.08] hover:border-white/20 hover:bg-[#16161c]'
                  }`}
                >
                  <div className="flex items-start space-x-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        !soundEffectsEnabled
                          ? 'bg-rose-500/20 text-rose-400'
                          : 'bg-indigo-500/20 text-indigo-400'
                      }`}
                    >
                      {soundEffectsEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                    </div>
                    <div className="min-w-0">
                      <span className="text-sm font-semibold text-white block">
                        Tüm Uygulama Ses Efektleri
                      </span>
                      <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                        {soundEffectsEnabled
                          ? 'Kapatıldığında Bas-Konuş, sesli sohbete katılma/ayrılma, mikrofon susturma, mesaj ve zil dahil tüm uygulama sesleri susar.'
                          : 'Şu anda uygulamadaki tüm ses efektleri tamamen kapalı (hoparlör donanım testi bundan etkilenmez).'}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`w-11 h-6 rounded-full transition-colors p-0.5 flex items-center flex-shrink-0 ${
                      soundEffectsEnabled ? 'bg-indigo-500' : 'bg-white/15'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        soundEffectsEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </button>

                {/* Ses Efekti Seviyesi */}
                <div
                  className={`p-4 rounded-xl bg-[#101015] border border-white/[0.08] space-y-2 transition-opacity ${
                    !soundEffectsEnabled ? 'opacity-45 pointer-events-none' : ''
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span className="font-semibold text-gray-300">Ses Efekti Seviyesi</span>
                    <span className="font-mono text-gray-200">{soundEffectsVolume}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    disabled={!soundEffectsEnabled}
                    value={soundEffectsVolume}
                    onChange={(e) => changeSoundEffectsVolume(Number(e.target.value))}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
              </div>

              {/* Ekran Paylaşımı Kalitesi & Oyun FPS Koruması */}
              <div className="pt-6 border-t border-white/[0.08] space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block">
                    EKRAN PAYLAŞIMI KALİTESİ (FPS KORUMASI)
                  </label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    CS2 ve diğer oyunlarda yayın yaparken GPU/CPU kodlama ve ağ yükünü buradan sınırlandırabilirsiniz.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {['performance', 'balanced', 'high'].map((presetKey) => {
                    const preset = SCREEN_SHARE_PRESETS[presetKey];
                    const currentPreset = chatSettings?.screenSharePreset || 'balanced';
                    const isSelected = currentPreset === presetKey;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          updateChatSetting('screenSharePreset', preset.id);
                          toast.success(`Ekran paylaşımı kalitesi: ${preset.label}`);
                        }}
                        className={`flex flex-col justify-between p-3.5 rounded-xl border text-left transition cursor-pointer gap-1.5 ${
                          isSelected
                            ? 'bg-indigo-600/15 border-indigo-500/60 shadow-[0_0_16px_rgba(139,81,255,0.12)]'
                            : 'bg-[#121216] border-white/[0.08] hover:border-white/20 hover:bg-[#16161c]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center space-x-1.5 text-xs font-semibold text-white">
                            <Monitor size={14} className={isSelected ? 'text-indigo-400' : 'text-gray-400'} />
                            <span>{preset.label}</span>
                          </span>
                          {isSelected && <Check size={14} className="text-indigo-400 flex-shrink-0" />}
                        </div>
                        <p className="text-[11px] text-gray-400 leading-relaxed">{preset.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DİL VE SAAT */}
          {activeTab === 'language_time' && (
            <div className="space-y-6">
              {/* Header: Dil ve Saat */}
              <div className="pb-4 border-b border-white/[0.08] flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Dil ve Saat</h2>
                  <p className="text-xs text-gray-400 mt-1">Uygulama dilini ve saat görüntüleme formatını belirleyin.</p>
                </div>
              </div>

              {/* Bir dil seç */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-200 uppercase tracking-wider block">
                  BİR DİL SEÇ
                </label>
                <p className="text-xs text-gray-400 mb-3">Voys'ta kullanmak istediğin dili seç.</p>
                
                <div className="relative" ref={langDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsLangDropdownOpen((prev) => !prev)}
                    className="w-full bg-[#111214] hover:bg-[#1e1f22] border border-black/40 rounded-lg py-2.5 px-3.5 flex items-center justify-between transition cursor-pointer select-none"
                  >
                    <div className="flex items-center space-x-2.5 text-white text-xs font-medium">
                      {(chatSettings?.language || 'tr') === 'en' ? (
                        <UKFlag className="w-5 h-3.5" />
                      ) : (
                        <TurkeyFlag className="w-5 h-3.5" />
                      )}
                      <span>
                        {(chatSettings?.language || 'tr') === 'en' ? 'English' : 'Türkçe'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-gray-400 text-xs">
                      <span>
                        {(chatSettings?.language || 'tr') === 'en' ? 'English' : 'Türkçe'}
                      </span>
                      <ChevronDown 
                        size={16} 
                        className={`text-gray-400 transition-transform duration-200 ${isLangDropdownOpen ? 'rotate-180 text-white' : ''}`} 
                      />
                    </div>
                  </button>

                  {/* Custom Language Options Dropdown */}
                  {isLangDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#111214] border border-white/10 rounded-lg shadow-2xl overflow-hidden z-50 p-1 space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
                      <button
                        type="button"
                        onClick={() => {
                          updateChatSetting('language', 'tr');
                          setIsLangDropdownOpen(false);
                          toast.success('Dil seçildi: Türkçe');
                        }}
                        className={`w-full px-3 py-2.5 rounded-md flex items-center justify-between text-xs transition cursor-pointer ${
                          (chatSettings?.language || 'tr') === 'tr'
                            ? 'bg-[#8B51FF] text-white font-semibold'
                            : 'text-gray-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <TurkeyFlag className="w-5 h-3.5" />
                          <span>Türkçe</span>
                        </div>
                        {(chatSettings?.language || 'tr') === 'tr' && (
                          <Check size={14} className="text-white flex-shrink-0" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          updateChatSetting('language', 'en');
                          setIsLangDropdownOpen(false);
                          toast.success('Language selected: English');
                        }}
                        className={`w-full px-3 py-2.5 rounded-md flex items-center justify-between text-xs transition cursor-pointer ${
                          chatSettings?.language === 'en'
                            ? 'bg-[#8B51FF] text-white font-semibold'
                            : 'text-gray-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <UKFlag className="w-5 h-3.5" />
                          <span>English</span>
                        </div>
                        {chatSettings?.language === 'en' && (
                          <Check size={14} className="text-white flex-shrink-0" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Zaman formatı */}
              <div className="pt-2 space-y-2">
                <label className="text-xs font-bold text-gray-200 uppercase tracking-wider block">
                  ZAMAN FORMATI
                </label>
                <p className="text-xs text-gray-400 mb-3">Mesaj ve bildirimlerde kullanılacak zaman formatını seçin.</p>
                
                <div className="space-y-3.5">
                  {[
                    { id: 'auto', label: 'Otomatik' },
                    { id: '12h', label: '12 saatlik' },
                    { id: '24h', label: '24 saatlik' }
                  ].map((opt) => {
                    const currentFormat = chatSettings?.timeFormat || (chatSettings?.timeFormat24h === false ? '12h' : 'auto');
                    const isSelected = currentFormat === opt.id;
                    return (
                      <div
                        key={opt.id}
                        onClick={() => {
                          updateChatSetting('timeFormat', opt.id);
                          updateChatSetting('timeFormat24h', opt.id === '12h' ? false : true);
                          toast.success(`Zaman formatı: ${opt.label}`);
                        }}
                        className="flex items-center space-x-3 cursor-pointer select-none group py-0.5"
                      >
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-[#8B51FF] border-2 border-[#8B51FF]'
                              : 'border-2 border-[#4e5058] group-hover:border-gray-400 bg-transparent'
                          }`}
                        >
                          {isSelected && (
                            <div className="w-2 h-2 rounded-full bg-white" />
                          )}
                        </div>
                        <span className={`text-sm transition ${
                          isSelected ? 'text-white font-medium' : 'text-gray-300 group-hover:text-white'
                        }`}>
                          {opt.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SİSTEM & İZLEME (ADMIN ONLY) */}
          {activeTab === 'system_monitor' && isAdmin && (
            <AdminMonitorTab onUserDeleted={onUserDeleted} />
          )}
        </div>
      </div>
    </div>
  );
};
