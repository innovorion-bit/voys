import React, { useState, useRef, useEffect } from 'react';
import { 
  Phone, 
  PhoneOff, 
  PhoneCall,
  Mic, 
  MicOff, 
  Headphones, 
  VolumeX, 
  ScreenShare, 
  Maximize2, 
  Minimize2,
  MessageSquare
} from 'lucide-react';
import { UserAvatar } from './UserAvatar';
import { ConnectionQualityIndicator } from './ConnectionQualityIndicator';
import { useSettings } from '../context/useSettings';
import { formatShortcutLabel } from '../services/shortcutService';

export const InChatCallStage = ({
  channelName = 'Sohbet',
  isInCall = false,
  callMembers = [],
  currentUser = null,
  isMuted = false,
  isDeafened = false,
  isSpeaking = false,
  isScreenSharing = false,
  activeScreenShare = null,
  callState = 'active', // 'ringing' | 'active'
  isCaller = false,
  callInitiator = null,
  targetUser = null,
  ringCount = 1,
  maxRings = 3,
  onCancelCall,
  onAcceptCall,
  onDeclineCall,
  onToggleMute,
  onToggleDeafen,
  onToggleScreenShare,
  onJoinCall,
  onLeaveCall,
  onToggleChatView = null,
}) => {
  const { inputMode, pttKey, isPttActive } = useSettings();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoRef = useRef(null);
  const stageRef = useRef(null);

  // Play video stream if screen sharing is active
  useEffect(() => {
    if (videoRef.current && activeScreenShare?.stream) {
      videoRef.current.srcObject = activeScreenShare.stream;
      videoRef.current.play().catch((err) => {
        console.warn('InChatCall screen share play error:', err);
      });
    }
  }, [activeScreenShare?.stream]);

  const toggleFullscreen = () => {
    if (!stageRef.current) return;
    if (!document.fullscreenElement) {
      stageRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // 1. Caller view while outgoing call is ringing (Aranıyor... / Çalıyor...)
  if (callState === 'ringing' && isCaller) {
    const targetName = targetUser?.name || targetUser?.display_name || channelName;
    return (
      <div className="flex-1 w-full h-full min-h-[420px] bg-[#08080a] flex flex-col items-center justify-between p-6 sm:p-12 select-none animate-in fade-in duration-300 relative overflow-hidden">
        {/* Top Info */}
        <div className="flex items-center space-x-2 text-xs font-mono text-gray-400 bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-full z-10">
          <PhoneCall size={13} className="text-indigo-400" />
          <span>Giden Sesli Arama • {channelName}</span>
        </div>

        {/* Center Target Info */}
        <div className="flex flex-col items-center text-center z-10 my-auto py-6">
          <div className="relative mb-6">
            <div className="relative rounded-full overflow-hidden p-1.5 bg-[#0e0e12] border-2 border-indigo-500/40 shadow-xl">
              <UserAvatar user={targetUser || { name: targetName }} size="2xl" className="w-28 h-28 text-3xl font-bold" showStatus={false} />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-wide">
              {targetName} aranıyor...
            </h2>
            <div className="flex items-center justify-center space-x-2 text-sm font-mono text-indigo-300">
              <PhoneCall size={15} className="text-indigo-400" />
              <span>Çalıyor ({ringCount}/{maxRings})</span>
            </div>
          </div>

          {/* 3 Rings Progress Indicator */}
          <div className="flex items-center space-x-2 mt-6">
            {[1, 2, 3].map((r) => (
              <div
                key={r}
                className={`h-2 rounded-full transition-all duration-300 ${
                  ringCount >= r 
                    ? 'w-10 bg-indigo-400 shadow-[0_0_12px_rgba(163,110,255,0.9)]' 
                    : 'w-3 bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Bottom Floating Control Bar */}
        <div className="z-10 bg-[#121216]/90 border border-white/10 backdrop-blur-xl rounded-3xl p-2.5 px-6 shadow-2xl flex items-center space-x-4">
          <button
            type="button"
            onClick={onToggleMute}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition border ${
              isMuted
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                : 'bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border-white/10'
            }`}
            title={isMuted ? 'Mikrofonu Aç' : 'Sustur'}
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          <button
            type="button"
            onClick={onToggleDeafen}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition border ${
              isDeafened
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                : 'bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border-white/10'
            }`}
            title={isDeafened ? 'Sağırlığı Kaldır' : 'Sağırlaştır'}
          >
            {isDeafened ? <VolumeX size={20} /> : <Headphones size={20} />}
          </button>

          <button
            type="button"
            onClick={onCancelCall || onLeaveCall}
            className="flex items-center space-x-2 px-6 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-xl shadow-rose-600/40 transition active:scale-95 cursor-pointer"
            title="Aramayı İptal Et"
          >
            <PhoneOff size={18} />
            <span>Aramayı İptal Et</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. Recipient view inside chat while call is ringing
  if (callState === 'ringing' && !isInCall && !isCaller) {
    const callerName = callInitiator?.name || callInitiator?.display_name || 'Kullanıcı';
    return (
      <div className="flex-1 w-full h-full min-h-[420px] bg-[#08080a] flex flex-col items-center justify-between p-6 sm:p-12 select-none animate-in fade-in duration-300 relative overflow-hidden">
        <div className="flex items-center space-x-2 text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-full z-10">
          <PhoneCall size={13} />
          <span>Gelen Sesli Arama • {channelName}</span>
        </div>

        <div className="flex flex-col items-center text-center z-10 my-auto py-6">
          <div className="relative mb-6">
            <div className="relative rounded-full overflow-hidden p-1.5 bg-[#0e0e12] border-2 border-emerald-500/40 shadow-xl">
              <UserAvatar user={callInitiator || { name: callerName }} size="2xl" className="w-28 h-28 text-3xl font-bold" showStatus={false} />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-wide">
              {callerName} arıyor...
            </h2>
            <p className="text-sm text-emerald-300/80 font-mono">
              Çalıyor ({ringCount}/{maxRings})
            </p>
          </div>
        </div>

        {/* Action Buttons: Reddet / Kabul Et */}
        <div className="z-10 flex items-center space-x-4">
          <button
            type="button"
            onClick={onDeclineCall}
            className="flex items-center space-x-2 px-6 py-3.5 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 hover:text-white font-bold text-sm transition active:scale-95 cursor-pointer"
          >
            <PhoneOff size={18} />
            <span>Reddet</span>
          </button>

          <button
            type="button"
            onClick={onAcceptCall || onJoinCall}
            className="flex items-center space-x-2 px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-sm rounded-2xl transition active:scale-95 cursor-pointer"
          >
            <Phone size={18} />
            <span>Kabul Et</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. Persistent Discord-style invitation banner when user is NOT in the call (e.g. after 3 rings finish)
  if (!isInCall) {
    const callerName = callInitiator?.name || (callMembers.length > 0 ? `${callMembers.length} kişi` : 'Sesli sohbet');
    return (
      <div className="mx-3 md:mx-4 mt-2.5 p-3 rounded-2xl bg-[#121216] border border-emerald-500/30 flex flex-wrap items-center justify-between gap-3 z-10 flex-shrink-0">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 flex-shrink-0">
            <Phone size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-white tracking-wide">
                Sesli Görüşme Aktif
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <p className="text-[11px] text-emerald-300/80 truncate">
              {callMembers.length > 0 
                ? `${callMembers.length} kişi bu sohbette sesli görüşüyor` 
                : `${callerName} seslide bekliyor`}
            </p>
          </div>
        </div>

        {/* Member Avatar previews */}
        <div className="flex items-center space-x-2">
          {callMembers.length > 0 && (
            <div className="flex -space-x-2 overflow-hidden mr-1">
              {callMembers.slice(0, 4).map((member, i) => (
                <div key={member.id || i} className="inline-block ring-2 ring-[#08080a] rounded-full">
                  <UserAvatar user={member} size="xs" showStatus={false} />
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={onJoinCall}
            className="flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition active:scale-95"
          >
            <Phone size={14} />
            <span>Aramaya Katıl</span>
          </button>
        </div>
      </div>
    );
  }

  // Active call view when user is connected (Tam ekran sahne)
  return (
    <div 
      ref={stageRef}
      className={`flex-1 w-full h-full min-h-0 bg-[#08080a] flex flex-col justify-between overflow-hidden select-none relative animate-in fade-in duration-300 ${
        isFullscreen ? 'fixed inset-0 m-0 rounded-none z-50' : ''
      }`}
    >
      {/* Top Header Bar */}
      <div className="h-12 px-6 bg-[#0c0c0e]/90 border-b border-white/5 flex items-center justify-between text-xs text-gray-300 flex-shrink-0 z-10 backdrop-blur-md">
        <div className="flex items-center space-x-2.5">
          <span className="inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          <span className="font-bold text-white text-xs sm:text-sm tracking-wide">
            Sesli Görüşme • {channelName}
          </span>
          <span className="text-[10px] text-gray-400 bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-full font-medium">
            {callMembers.length} Katılımcı
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {onToggleChatView && (
            <button
              type="button"
              onClick={onToggleChatView}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition border border-white/10 text-xs font-semibold cursor-pointer"
              title="Mesajları Görüntüle"
            >
              <MessageSquare size={14} />
              <span className="hidden sm:inline">Metin Sohbeti</span>
            </button>
          )}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition border border-white/10"
            title={isFullscreen ? "Tam Ekrandan Çık" : "Tam Ekran Yap"}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </div>

      {/* Main Call Stage Body: Participants Grid & Waiting Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 min-h-0 overflow-y-auto relative z-10">
        {/* Screen Share Player if active */}
        {activeScreenShare?.stream && (
          <div className="relative w-full max-h-[60vh] bg-black/90 rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center mb-6 shadow-xl">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
            <div className="absolute top-3 left-3 bg-black/80 px-3 py-1 rounded-xl text-xs text-white flex items-center space-x-2 border border-white/10">
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
              <span>{activeScreenShare.userName || 'Ekran Paylaşımı'}</span>
            </div>
          </div>
        )}

        {/* Participant Cards Grid */}
        <div className="flex flex-wrap items-center justify-center gap-5 sm:gap-8 max-w-4xl w-full my-auto">
          {callMembers.map((member) => {
            const isLocal = member.id === currentUser?.id || member.id === 'you';
            const memberSpeaking = isLocal ? isSpeaking : member.isSpeaking;
            const memberMuted = isLocal ? isMuted : member.isMuted;
            
            return (
              <div
                key={member.id || member.peerId}
                className={`w-48 h-56 sm:w-56 sm:h-64 rounded-3xl flex flex-col items-center justify-between p-5 transition-colors duration-150 relative bg-[#121216] border shadow-xl ${
                  memberSpeaking
                    ? 'border-emerald-500 ring-2 ring-emerald-500/50'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                {/* Top Ping & Mic Status */}
                <div className="w-full flex items-center justify-between">
                  <div className="flex items-center space-x-1 bg-black/30 px-2 py-0.5 rounded-lg border border-white/5">
                    <ConnectionQualityIndicator ping={member.ping || 24} />
                    <span className="text-[10px] font-mono text-gray-400">{member.ping || 24}ms</span>
                  </div>

                  {memberMuted && (
                    <div className="w-6 h-6 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400" title="Mikrofon Kapalı">
                      <MicOff size={12} />
                    </div>
                  )}
                </div>

                {/* Big Center Avatar with Speaking Ring */}
                <div className="relative my-auto">
                  <div className={`p-1.5 rounded-full transition-colors duration-150 ${memberSpeaking ? 'ring-3 ring-emerald-400' : ''}`}>
                    <UserAvatar
                      user={member}
                      size="xl"
                      className="w-24 h-24 text-3xl font-bold shadow-lg"
                      showStatus={false}
                    />
                  </div>
                </div>

                {/* Member Name */}
                <div className="w-full text-center">
                  <span className="text-sm sm:text-base font-bold text-white truncate block max-w-full">
                    {isLocal ? `${member.name} (Sen)` : member.name}
                  </span>
                  <span className="text-[11px] text-gray-400 block mt-0.5">
                    {memberMuted ? 'Susturuldu' : 'Bağlı'}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Katılımcı Bekleniyor Kartı (Tek kişi olduğunda) */}
          {callMembers.length <= 1 && (
            <div className="w-48 h-56 sm:w-56 sm:h-64 rounded-3xl border-2 border-dashed border-white/15 bg-white/[0.02] flex flex-col items-center justify-center p-6 text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-white/5 border border-dashed border-white/20 flex items-center justify-center text-indigo-400 shadow-inner">
                <PhoneCall size={30} className="text-indigo-400/80" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-sm font-bold text-gray-200">
                  Katılımcı Bekleniyor...
                </h4>
                <p className="text-xs text-gray-400 leading-relaxed max-w-[180px]">
                  Diğer kişinin görüşmeye katılması bekleniyor.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Voice Controls Bottom Toolbar */}
      <div className="h-20 px-6 sm:px-10 bg-[#0c0c0e] border-t border-white/5 flex items-center justify-between flex-shrink-0 z-10">
        {/* Left: Input Mode / PTT Info */}
        <div className="flex items-center space-x-2 text-xs text-gray-400 min-w-0">
          {inputMode === 'ptt' ? (
            <span className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold flex items-center space-x-1.5 border ${
              isPttActive 
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm' 
                : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
            }`}>
              <span>Bas-Konuş:</span>
              <strong className="text-white">[{formatShortcutLabel(pttKey)}]</strong>
              {isPttActive && <span className="w-2 h-2 rounded-full bg-emerald-400 ml-1" />}
            </span>
          ) : (
            <div className="flex items-center space-x-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-xl">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="font-medium hidden sm:inline">Açık Mikrofon Aktif</span>
            </div>
          )}
        </div>

        {/* Center / Right: Control Action Buttons */}
        <div className="flex items-center space-x-3">
          {/* Mic Mute Toggle */}
          <button
            type="button"
            onClick={onToggleMute}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition active:scale-95 ${
              isMuted
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30'
                : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
            }`}
            title={isMuted ? 'Mikrofonu Aç' : 'Mikrofonu Sustur'}
          >
            {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
          </button>

          {/* Deafen Toggle */}
          <button
            type="button"
            onClick={onToggleDeafen}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition active:scale-95 ${
              isDeafened
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30'
                : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
            }`}
            title={isDeafened ? 'Sağırlığı Kaldır' : 'Sesi Kapat (Deafen)'}
          >
            {isDeafened ? <VolumeX size={18} /> : <Headphones size={18} />}
          </button>

          {/* Screen Share Toggle */}
          <button
            type="button"
            onClick={onToggleScreenShare}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition active:scale-95 ${
              isScreenSharing
                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/50 shadow-sm'
                : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
            }`}
            title={isScreenSharing ? 'Ekran Paylaşımını Durdur' : 'Ekranını Paylaş'}
          >
            <ScreenShare size={18} />
          </button>

          {/* Red Leave Call Button */}
          <button
            type="button"
            onClick={onLeaveCall}
            className="flex items-center space-x-2 px-6 py-3 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold text-xs rounded-2xl shadow-xl shadow-rose-600/30 transition active:scale-95 cursor-pointer"
            title="Aramadan Ayrıl"
          >
            <PhoneOff size={16} />
            <span>Ayrıl</span>
          </button>
        </div>
      </div>
    </div>
  );
};
