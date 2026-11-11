import React, { useRef, useEffect, useState } from 'react';
import { 
  Users, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Minimize2, 
  Mic, 
  MicOff, 
  Headphones, 
  Video, 
  VideoOff, 
  ScreenShare, 
  PhoneOff, 
  ChevronDown, 
  UserPlus,
  MessageSquare
} from 'lucide-react';
import { UserAvatar } from './UserAvatar';
import { ConnectionQualityIndicator } from './ConnectionQualityIndicator';
import { useSettings } from '../context/useSettings';
import { formatShortcutLabel } from '../services/shortcutService';

export const VoiceStageArea = ({
  activeChannelName = 'Sesli Sohbet',
  _channelType = 'voice',
  isConnected = true,
  isMuted = false,
  isDeafened = false,
  isSpeaking = false,
  isScreenSharing = false,
  activeScreenShare = null,
  onToggleMute,
  onToggleDeafen,
  onToggleScreenShare,
  onDisconnect,
  onOpenAddMember,
  onToggleChat,
  isChatOpen = false,
  currentUser = null,
  voiceMembers = [],
}) => {
  const { inputMode, pttKey, isPttActive } = useSettings();
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [streamVolume, setStreamVolume] = useState(80);
  const [isCamActive, setIsCamActive] = useState(false);

  // Connect MediaStream to the video element if an active stream exists
  useEffect(() => {
    if (videoRef.current && activeScreenShare?.stream) {
      videoRef.current.srcObject = activeScreenShare.stream;
      videoRef.current.play().catch((err) => {
        console.warn('Screen share video play error:', err);
      });
    }
  }, [activeScreenShare?.stream]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
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

  const streamerName = activeScreenShare?.userName || (activeScreenShare?.isLocal ? 'Sen (You)' : (activeScreenShare?.peerId ? `Kullanıcı ${activeScreenShare.peerId.slice(0, 5)}` : 'Ekran Paylaşımı'));

  // Real connected participants
  const localParticipant = {
    id: currentUser?.id || 'you',
    name: currentUser?.name || 'Sen (You)',
    avatar: currentUser?.avatar,
    initial: (currentUser?.name || 'S').slice(0, 1).toUpperCase(),
    color: '#8B51FF',
    isSpeaking: isSpeaking,
    isMuted: isMuted,
    isCurrentUser: true,
    ping: (voiceMembers.find(m => m.id === (currentUser?.id || 'you'))?.ping) || 24,
  };

  const remoteParticipants = (voiceMembers || [])
    .filter(m => m.id !== (currentUser?.id || 'you') && m.peerId !== (currentUser?.id || 'you'))
    .map((peer, idx) => {
      const colors = ['#f43f5e', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];
      const color = colors[idx % colors.length];
      const name = peer.name || `Kullanıcı ${peer.peerId ? peer.peerId.slice(0, 5) : idx + 1}`;
      return {
        id: peer.id || peer.peerId || `peer-${idx}`,
        name: name,
        avatar: peer.avatar,
        initial: name.slice(0, 1).toUpperCase(),
        color: color,
        isSpeaking: !!peer.isSpeaking,
        isMuted: !!peer.isMuted,
        isCurrentUser: false,
        ping: peer.ping || 32,
      };
    });

  const displayParticipants = isConnected
    ? [localParticipant, ...remoteParticipants]
    : [];

  return (
    <div 
      ref={containerRef}
      className="flex-1 flex flex-col h-full bg-[#08080a] relative select-none overflow-hidden"
    >
      {/* Top Stage Header Bar */}
      <header className="h-16 px-6 flex items-center justify-between border-b border-white/5 bg-[#0c0c0e]/80 backdrop-blur-md flex-shrink-0 z-10">
        {/* Left: Active Channel Badge & Name */}
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-2xl bg-[#1d2d24] border border-[#22c55e]/30 flex items-center justify-center text-[#22c55e]">
            <Volume2 size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-wide flex items-center space-x-2">
              <span>{activeChannelName}</span>
            </h1>
            <p className="text-xs text-gray-400">Ses kanalı</p>
          </div>
        </div>

        {/* Right: Participants count & Connection status & Add Member */}
        <div className="flex items-center space-x-3">
          {/* Member Count Pill */}
          <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#141418] border border-white/5 rounded-xl text-xs font-semibold text-gray-200 shadow-sm">
            <Users size={14} className="text-gray-400" />
            <span>Seste {displayParticipants.length} kişi</span>
          </div>

          {/* Connected Status Pill */}
          <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm border ${
            isConnected
              ? 'bg-[#14291f] border-[#22c55e]/30 text-[#22c55e]'
              : 'bg-[#26171a] border-[#ef4444]/30 text-[#ef4444]'
          }`}>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`} />
            <span>{isConnected ? 'Bağlandı' : 'Bağlantı Kesildi'}</span>
          </div>

          {/* Add Member Button */}
          {onOpenAddMember && (
            <button
              type="button"
              onClick={onOpenAddMember}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#18181f] hover:bg-[#22222a] border border-indigo-500/30 text-indigo-300 rounded-xl text-xs font-semibold transition"
              title="Sohbete Arkadaş Ekle"
            >
              <UserPlus size={14} />
              <span className="hidden sm:inline">Üye Ekle</span>
            </button>
          )}

          {/* Toggle Text Chat Button */}
          <button
            type="button"
            onClick={onToggleChat}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
              isChatOpen 
                ? 'bg-indigo-600 text-white border-indigo-500' 
                : 'bg-[#141418] text-gray-300 border-white/5 hover:bg-[#1a1a20]'
            }`}
            title="Sohbet Panelini Göster / Gizle"
          >
            <MessageSquare size={14} />
            <span className="hidden sm:inline">Sohbet</span>
          </button>
        </div>
      </header>

      {/* Main Content Area (Screen Share Showcase + Participant Grid) */}
      <div className="flex-1 flex flex-col p-4 md:p-6 overflow-y-auto space-y-4 min-h-0 relative pb-28">
        
        {/* UPPER SECTION: Screen Share Showcase Card */}
        <div className="w-full bg-[#0c0c0e] border border-white/5 rounded-2xl shadow-2xl relative overflow-hidden flex flex-col flex-1 min-h-[260px] max-h-[440px]">
          {/* Card Top Title Bar (Mac-Style dots) */}
          <div className="h-8 px-4 bg-[#0e0e12] border-b border-white/5 flex items-center justify-between z-10 flex-shrink-0">
            {/* Traffic Lights */}
            <div className="flex items-center space-x-1.5">
              <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
              <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
              <span className="text-xs text-gray-400 font-medium ml-3">
                {activeScreenShare ? `${streamerName} Ekranı` : 'Ekran Paylaşımı'}
              </span>
            </div>

            {/* Top Right Controls Overlay: Fullscreen + Volume (when active stream) */}
            {activeScreenShare?.stream && (
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="flex items-center space-x-1.5 px-2.5 py-1 bg-[#141418] hover:bg-[#1a1a20] text-gray-200 border border-white/10 rounded-lg text-[11px] font-medium transition shadow-sm"
                >
                  {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                  <span>Büyütmek için tıkla</span>
                </button>

                <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-[#141418] border border-white/10 rounded-lg text-gray-300 text-[11px]">
                  <Volume2 size={13} className="text-gray-400" />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={streamVolume}
                    onChange={(e) => setStreamVolume(Number(e.target.value))}
                    className="w-16 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-400"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Screen Content View */}
          <div className="flex-1 w-full h-full relative flex items-center justify-center bg-[#08080a] overflow-hidden">
            {activeScreenShare?.stream ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
            ) : (
              /* Clean Minimal Stage Showcase */
              <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center select-none bg-gradient-to-b from-[#0c0c0e] to-[#08080a]">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 mb-3 shadow-inner">
                  <ScreenShare size={28} className="text-gray-400" />
                </div>
                <h3 className="text-sm font-bold text-gray-300">Aktif Bir Ekran Paylaşımı Yok</h3>
                <p className="text-xs text-gray-500 mt-1 max-w-sm">
                  Ses kanalındaki kullanıcılar ekranlarını paylaştığında burada canlı olarak görüntülenecektir.
                </p>
                <button
                  type="button"
                  onClick={onToggleScreenShare}
                  className="mt-4 flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-indigo-600/30 transition transform hover:scale-105 active:scale-95"
                >
                  <ScreenShare size={15} />
                  <span>{isScreenSharing ? 'Ekran Paylaşımını Durdur' : 'Kendi Ekranını Paylaş'}</span>
                </button>
              </div>
            )}

            {/* Bottom Left Streamer Pill Tag (only when active screen share) */}
            {activeScreenShare && (
              <div className="absolute bottom-3 left-4 flex items-center space-x-2 px-3 py-1.5 bg-[#121216]/90 backdrop-blur-md border border-white/10 rounded-xl text-xs font-semibold text-gray-200 shadow-lg">
                <span className="text-gray-400">🖥</span>
                <span>{`${streamerName} Ekranı`}</span>
              </div>
            )}
          </div>
        </div>

        {/* LOWER SECTION: Participant Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 w-full">
          {displayParticipants.map((p) => {
            const isSpeakingActive = p.isSpeaking || (p.isCurrentUser && isSpeaking);

            return (
              <div
                key={p.id}
                className={`h-40 sm:h-44 rounded-2xl flex flex-col items-center justify-center p-4 relative transition-colors overflow-hidden ${
                  isSpeakingActive
                    ? 'speaking-card-glow border-2 border-[#22c55e] bg-[#101816]'
                    : 'bg-[#0c0c0e] border border-white/5 hover:border-white/10'
                }`}
              >
                {/* Top-Right: Connection Quality Indicator */}
                <div className="absolute top-2.5 right-2.5 z-10">
                  <ConnectionQualityIndicator ping={p.ping || 24} />
                </div>

                {/* User Center Avatar */}
                <div className="relative flex items-center justify-center">
                  <div
                    className={`rounded-2xl ${
                      isSpeakingActive ? 'speaking-ring ring-2 ring-[#22c55e] ring-offset-2 ring-offset-[#0c0c0e]' : ''
                    }`}
                  >
                    <UserAvatar
                      user={{
                        id: p.id,
                        name: p.name,
                        avatar: p.avatar,
                      }}
                      size="xl"
                      showStatus={false}
                    />
                  </div>
                </div>

                {/* Bottom Tag Label (Name + Status) */}
                <div className="absolute bottom-2.5 left-3 flex items-center space-x-1.5 px-2.5 py-1 bg-[#121216] rounded-lg text-xs font-semibold text-white border border-white/5 max-w-[85%]">
                  {isSpeakingActive ? (
                    <div className="w-2 h-2 rounded-full bg-[#22c55e] flex-shrink-0" />
                  ) : p.isMuted ? (
                    <MicOff size={12} className="text-[#ef4444] flex-shrink-0" />
                  ) : null}
                  <span className="truncate">{p.name}</span>
                </div>
              </div>
            );
          })}

          {/* Inviting Slot when only 1 participant is in voice */}
          {displayParticipants.length === 1 && onOpenAddMember && (
            <div 
              onClick={onOpenAddMember}
              className="h-40 sm:h-44 rounded-2xl border border-dashed border-white/10 hover:border-indigo-500/40 bg-white/[0.02] hover:bg-indigo-500/[0.04] flex flex-col items-center justify-center p-4 cursor-pointer transition group"
              title="Arkadaş Ekle"
            >
              <div className="w-12 h-12 rounded-full bg-white/5 group-hover:bg-indigo-600/20 text-gray-400 group-hover:text-indigo-400 flex items-center justify-center transition">
                <UserPlus size={20} />
              </div>
              <p className="mt-2.5 text-xs font-semibold text-gray-300 group-hover:text-white transition">Oda Boş</p>
              <p className="text-[11px] text-gray-500 text-center mt-0.5">Arkadaşlarını sohbete davet et</p>
            </div>
          )}

          {/* Empty State when not connected */}
          {displayParticipants.length === 0 && (
            <div className="col-span-full py-8 text-center text-xs text-gray-500 bg-[#131627]/40 rounded-2xl border border-white/5 p-6">
              Sesli kanala bağlı değilsiniz. Katılmak için aşağıdaki mikrofon veya bağlan butonunu kullanabilirsiniz.
            </div>
          )}
        </div>
      </div>

      {/* FLOATING BOTTOM CONTROL CAPSULE (DOCK BAR) */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30">
        <div className="floating-capsule rounded-full px-5 py-2.5 flex items-center space-x-3.5 shadow-2xl">
          {/* 1. Microphone Toggle */}
          <div className="flex items-center space-x-0.5">
            <button
              type="button"
              onClick={onToggleMute}
              className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                isPttActive
                  ? 'bg-[#22c55e] text-white ring-2 ring-emerald-400'
                  : isMuted
                  ? 'bg-[#ef4444] text-white shadow-lg shadow-red-500/25'
                  : 'bg-[#1a1a22] hover:bg-[#252530] text-gray-200'
              }`}
              title={
                inputMode === 'ptt'
                  ? `Bas-Konuş [ ${formatShortcutLabel(pttKey)} ]: ${isPttActive ? 'Konuşuluyor' : 'Basılı tutarak konuşun'}`
                  : isMuted 
                  ? 'Mikrofonu Aç' 
                  : 'Mikrofonu Kapat'
              }
            >
              {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
              {inputMode === 'ptt' && (
                <span className="absolute -bottom-1 -right-1 text-[8px] font-mono font-black bg-indigo-600 text-white px-1 rounded-sm shadow-sm pointer-events-none">
                  PTT
                </span>
              )}
            </button>
            <button type="button" className="text-gray-400 hover:text-white p-1">
              <ChevronDown size={12} />
            </button>
          </div>

          {/* 2. Deafen / Headphones Toggle */}
          <button
            type="button"
            onClick={onToggleDeafen}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              isDeafened
                ? 'bg-[#ef4444] text-white shadow-lg shadow-red-500/25'
                : 'bg-[#1a1a22] hover:bg-[#252530] text-gray-200'
            }`}
            title={isDeafened ? 'Kulaklığı Aç' : 'Kulaklığı Kapat'}
          >
            {isDeafened ? <VolumeX size={18} /> : <Headphones size={18} />}
          </button>

          {/* 3. Camera Toggle */}
          <div className="flex items-center space-x-0.5">
            <button
              type="button"
              onClick={() => setIsCamActive(!isCamActive)}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                isCamActive
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'bg-[#1a1a22] hover:bg-[#252530] text-gray-300'
              }`}
              title={isCamActive ? 'Kamerayı Kapat' : 'Kamerayı Aç'}
            >
              {isCamActive ? <Video size={18} /> : <VideoOff size={18} />}
            </button>
            <button type="button" className="text-gray-400 hover:text-white p-1">
              <ChevronDown size={12} />
            </button>
          </div>

          {/* 5. Screen Share Toggle (Prominent White Button matching screenshot) */}
          <button
            type="button"
            onClick={onToggleScreenShare}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-md transform hover:scale-105 active:scale-95 ${
              isScreenSharing
                ? 'bg-[#22c55e] text-white'
                : 'bg-white text-black hover:bg-gray-100'
            }`}
            title={isScreenSharing ? 'Ekran Paylaşımını Durdur' : 'Ekran Paylaş'}
          >
            <ScreenShare size={20} />
          </button>

          {/* 6. Disconnect / Ayrıl Button (Vibrant Coral Red button with glow) */}
          <button
            type="button"
            onClick={onDisconnect}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-full bg-[#ef4444] hover:bg-[#dc2626] text-white font-bold text-xs shadow-[0_4px_20px_rgba(239,68,68,0.4)] transition-all transform hover:scale-105 active:scale-95"
            title="Sesli Kanaldan Ayrıl"
          >
            <PhoneOff size={16} />
            <span>Ayrıl</span>
          </button>
        </div>
      </div>
    </div>
  );
};
