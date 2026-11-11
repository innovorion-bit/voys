import React from 'react';
import { 
  Mic, 
  MicOff, 
  Headphones, 
  VolumeX, 
  Phone,
  PhoneOff,
  ScreenShare
} from 'lucide-react';
import { useSettings } from '../context/useSettings';
import { formatShortcutLabel } from '../services/shortcutService';

export const VoiceControls = ({
  isConnected = false,
  isInCall = false,
  isCallActive = false,
  callMembersCount = 0,
  isMuted = false,
  isDeafened = false,
  isScreenSharing = false,
  onToggleMute,
  onToggleDeafen,
  onToggleScreenShare,
  onDisconnect,
  onConnect,
}) => {
  const { inputMode, pttKey, isPttActive } = useSettings();
  const inCall = Boolean(isInCall || isConnected);

  // When NOT in call: Show single minimalist phone button (with green pulse if active call in room)
  if (!inCall) {
    return (
      <button
        type="button"
        onClick={onConnect}
        title={isCallActive ? `Sesli Sohbete Katıl ${callMembersCount > 0 ? `(${callMembersCount} kişi seste)` : ''}` : "Sesli Sohbet Başlat"}
        className={`relative w-8 h-8 rounded-xl flex items-center justify-center transition active:scale-95 cursor-pointer ${
          isCallActive
            ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
            : 'text-gray-300 hover:text-white hover:bg-white/10'
        }`}
      >
        <Phone size={17} />
        {isCallActive && (
          <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 ring-2 ring-[#0c0c0e]"></span>
          </span>
        )}
      </button>
    );
  }

  // When IN CALL: Show compact in-call controls (End Call, Mic, Deafen, Screen Share)
  return (
    <div className="flex items-center space-x-1 p-0.5 bg-[#121526]/90 backdrop-blur-md rounded-xl border border-white/10 select-none shadow-sm animate-in fade-in duration-150">
      {/* End Call Button */}
      <button
        type="button"
        onClick={onDisconnect}
        title="Sesli Sohbetten Ayrıl"
        className="w-8 h-8 flex items-center justify-center bg-rose-600 hover:bg-rose-500 text-white rounded-lg shadow-sm transition active:scale-95"
      >
        <PhoneOff size={15} />
      </button>

      {/* Mic Mute / Unmute / Push-to-Talk */}
      <button
        type="button"
        onClick={onToggleMute}
        title={
          inputMode === 'ptt'
            ? `Bas-Konuş [ ${formatShortcutLabel(pttKey)} ]: ${isPttActive ? 'Konuşuluyor' : 'Basılı tutarak konuşun'}`
            : isMuted 
            ? 'Mikrofonu Aç' 
            : 'Mikrofonu Kapat'
        }
        className={`relative w-8 h-8 flex items-center justify-center rounded-lg transition active:scale-95 ${
          isPttActive
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
            : isMuted
            ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30'
            : 'hover:bg-white/10 text-gray-200 hover:text-white'
        }`}
      >
        {isMuted ? <MicOff size={15} /> : <Mic size={15} />}
        {inputMode === 'ptt' && (
          <span className="absolute -bottom-0.5 -right-0.5 text-[7px] font-mono font-bold bg-indigo-600 text-white px-0.5 rounded pointer-events-none">
            PTT
          </span>
        )}
      </button>

      {/* Deafen (Mute Sound / Unmute Sound) */}
      <button
        type="button"
        onClick={onToggleDeafen}
        title={isDeafened ? 'Kulaklığı Aç' : 'Kulaklığı Kapat'}
        className={`w-8 h-8 flex items-center justify-center rounded-lg transition active:scale-95 ${
          isDeafened
            ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30'
            : 'hover:bg-white/10 text-gray-200 hover:text-white'
        }`}
      >
        {isDeafened ? <VolumeX size={15} /> : <Headphones size={15} />}
      </button>

      {/* Screen Share Button */}
      <button
        type="button"
        onClick={onToggleScreenShare}
        title={isScreenSharing ? 'Ekran Paylaşımını Durdur' : 'Ekranını Paylaş'}
        className={`w-8 h-8 flex items-center justify-center rounded-lg transition active:scale-95 ${
          isScreenSharing
            ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.3)]'
            : 'hover:bg-white/10 text-gray-300 hover:text-white'
        }`}
      >
        <ScreenShare size={15} className={isScreenSharing ? 'text-indigo-400 animate-pulse' : ''} />
      </button>
    </div>
  );
};
