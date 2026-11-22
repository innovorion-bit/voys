import React, { useRef, useEffect, useState } from 'react';
import { 
  Maximize2, 
  Minimize2, 
  Volume2, 
  VolumeX,
  Monitor,
  MonitorX,
  X,
} from 'lucide-react';

export const ScreenShareStage = ({
  activeScreenShare = null,
  availableScreenShares = [],
  onSelectScreenShare,
  onStopScreenShare,
  onCloseStage,
  isPipMode = false,
  onTogglePip,
}) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [internalPip, setInternalPip] = useState(false);

  const pip = isPipMode !== undefined ? isPipMode : internalPip;
  const setPip = (val) => {
    setInternalPip(val);
    if (onTogglePip) onTogglePip(val);
  };

  // Connect MediaStream to the video element whenever stream changes
  useEffect(() => {
    if (videoRef.current && activeScreenShare?.stream) {
      videoRef.current.srcObject = activeScreenShare.stream;
      if (!activeScreenShare.isLocal) {
        videoRef.current.muted = false;
        setIsMuted(false);
        videoRef.current.play().catch(() => {
          if (videoRef.current) {
            videoRef.current.muted = true;
            setIsMuted(true);
            videoRef.current.play().catch(() => {});
          }
        });
      } else {
        videoRef.current.muted = true;
        setIsMuted(true);
        videoRef.current.play().catch(() => {});
      }
    }
  }, [activeScreenShare?.stream, activeScreenShare?.isLocal]);

  // Fullscreen toggle
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
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  if (!activeScreenShare || !activeScreenShare.stream) return null;

  const isLocal = !!activeScreenShare.isLocal;
  const sharesList = availableScreenShares && availableScreenShares.length > 0
    ? availableScreenShares
    : [activeScreenShare];

  return (
    <div
      ref={containerRef}
      className={`transition-all duration-300 ease-in-out select-none group ${
        pip
          ? 'absolute top-14 right-4 z-40 w-72 sm:w-88 md:w-96 shadow-2xl border border-white/15 rounded-2xl overflow-hidden bg-[#0c0c0e] flex flex-col'
          : 'flex-1 h-full w-full min-h-0 flex flex-col bg-[#070709] relative overflow-hidden'
      }`}
    >
      {/* Top Floating Switcher Overlay for Multiple Screen Shares */}
      <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between pointer-events-none">
        {/* Stream Switcher Tabs */}
        <div className="flex items-center space-x-1.5 p-1 bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl pointer-events-auto overflow-x-auto max-w-[calc(100%-110px)] scrollbar-none shadow-lg">
          {sharesList.map((share) => {
            const isSelected = activeScreenShare?.peerId === share.peerId;
            return (
              <button
                key={share.peerId}
                type="button"
                onClick={() => onSelectScreenShare?.(share.peerId)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs transition cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium shadow-md shadow-indigo-500/30'
                    : 'text-gray-300 hover:text-white hover:bg-white/10'
                }`}
                title={share.userName || (share.isLocal ? 'Senin Ekranın' : 'Kullanıcı')}
              >
                <Monitor size={12} className={isSelected ? 'text-white' : 'text-indigo-400'} />
                <span className="truncate max-w-[130px]">
                  {share.userName || (share.isLocal ? 'Senin Ekranın' : 'Kullanıcı')}
                </span>
                {share.isLocal && <span className="text-[10px] text-indigo-200 font-normal">(Sen)</span>}
                <span className={`text-[10px] px-1.5 py-0.2 rounded ${isSelected ? 'bg-white/20 text-white' : 'bg-white/5 text-gray-400'}`}>
                  {share.qualityLabel || 'Canlı'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Top Right Actions: Stop share if local, plus Close/Minimize stage */}
        <div className="flex items-center space-x-1.5 pointer-events-auto shrink-0 ml-2">
          {isLocal && onStopScreenShare && (
            <button
              type="button"
              onClick={onStopScreenShare}
              className="h-8 px-2.5 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white text-xs flex items-center space-x-1.5 font-medium transition cursor-pointer shadow-lg backdrop-blur-md"
              title="Ekran Paylaşımını Durdur"
            >
              <MonitorX size={14} />
              <span className="hidden sm:inline">Durdur</span>
            </button>
          )}
          {onCloseStage && (
            <button
              type="button"
              onClick={onCloseStage}
              className="w-8 h-8 rounded-xl bg-black/60 hover:bg-black/90 text-gray-400 hover:text-white border border-white/10 flex items-center justify-center transition cursor-pointer shadow-lg backdrop-blur-md"
              title="Yayını Gizle (Sohbete Dön)"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Video Stream Stage */}
      <div
        className={`relative flex items-center justify-center bg-black overflow-hidden ${
          pip ? 'h-44 sm:h-52 w-full' : 'flex-1 min-h-0 w-full'
        }`}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal || isMuted}
          className="w-full h-full object-contain bg-black"
        />
      </div>

      {/* Stage Bottom Controls */}
      <div
        className={`flex items-center justify-between ${
          pip ? 'px-2.5 py-1.5' : 'px-4 py-3'
        } z-10 flex-shrink-0 select-none bg-black/40 backdrop-blur-sm border-t border-white/[0.04]`}
      >
        {/* Current Stream Info */}
        <div className="flex items-center space-x-2 text-xs text-gray-300 min-w-0 truncate">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="font-medium text-white truncate">{activeScreenShare.userName || (isLocal ? 'Sen' : 'Kullanıcı')}</span>
          <span className="text-gray-500">•</span>
          <span className="text-gray-400 shrink-0">{activeScreenShare.qualityLabel || 'Canlı Yayın'}</span>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {/* Audio Mute/Unmute for remote stream */}
          {!isLocal && (
            <button
              type="button"
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.muted = !isMuted;
                  setIsMuted(!isMuted);
                }
              }}
              className={`${
                pip ? 'w-7 h-7' : 'w-9 h-9'
              } rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white flex items-center justify-center transition cursor-pointer`}
              title={isMuted ? "Sesi Aç" : "Sesi Kapat"}
            >
              {isMuted ? <VolumeX size={pip ? 13 : 16} /> : <Volume2 size={pip ? 13 : 16} className="text-emerald-400" />}
            </button>
          )}

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className={`${
              pip ? 'w-7 h-7' : 'w-9 h-9'
            } rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white flex items-center justify-center transition cursor-pointer`}
            title={isFullscreen ? "Tam Ekrandan Çık" : "Tam Ekran Yap"}
          >
            {isFullscreen ? <Minimize2 size={pip ? 13 : 16} /> : <Maximize2 size={pip ? 13 : 16} />}
          </button>
        </div>
      </div>
    </div>
  );
};
