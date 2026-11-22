import React, { useRef, useEffect, useState } from 'react';
import { 
  Maximize2, 
  Minimize2, 
  Volume2, 
  VolumeX,
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
          pip ? 'px-2.5 py-1.5' : 'px-4 py-2.5 sm:py-3'
        } z-10 flex-shrink-0 select-none bg-black/60 backdrop-blur-md border-t border-white/[0.06]`}
      >
        {/* Current Stream Info & Multi-stream switcher */}
        <div className="flex items-center space-x-2 text-xs text-gray-300 min-w-0 truncate">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="font-medium text-white truncate">{activeScreenShare.userName || (isLocal ? 'Sen (You)' : 'Kullanıcı')}</span>
          <span className="text-gray-500">•</span>
          <span className="text-gray-400 shrink-0">{activeScreenShare.qualityLabel || 'Canlı Yayın'}</span>

          {/* Quick switcher buttons if multiple users are sharing */}
          {availableScreenShares && availableScreenShares.length > 1 && (
            <div className="hidden sm:flex items-center space-x-1 ml-2 pl-2 border-l border-white/10 shrink-0">
              {availableScreenShares.map((s) => {
                const isSelected = activeScreenShare?.peerId === s.peerId;
                return (
                  <button
                    key={s.peerId}
                    type="button"
                    onClick={() => onSelectScreenShare?.(s.peerId)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] transition cursor-pointer truncate max-w-[110px] ${
                      isSelected
                        ? 'bg-purple-600/40 text-purple-200 border border-purple-500/30 font-medium'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                    title={s.userName || (s.isLocal ? 'Sen' : 'Kullanıcı')}
                  >
                    {s.userName || (s.isLocal ? 'Sen' : 'Yayın')}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2 shrink-0 ml-2">
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
                pip ? 'w-7 h-7' : 'w-8 sm:w-9 h-8 sm:h-9'
              } rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white flex items-center justify-center transition cursor-pointer`}
              title={isMuted ? "Sesi Aç" : "Sesi Kapat"}
            >
              {isMuted ? <VolumeX size={pip ? 13 : 16} /> : <Volume2 size={pip ? 13 : 16} className="text-emerald-400" />}
            </button>
          )}

          {/* Stop screen share button moved to bottom controls */}
          {isLocal && onStopScreenShare && (
            <button
              type="button"
              onClick={onStopScreenShare}
              className={`${
                pip ? 'h-7 px-2 text-[11px]' : 'h-8 sm:h-9 px-3 text-xs'
              } rounded-xl bg-rose-600 hover:bg-rose-500 text-white flex items-center space-x-1.5 font-medium transition cursor-pointer shadow-md`}
              title="Ekran Paylaşımını Durdur"
            >
              <MonitorX size={pip ? 12 : 14} />
              <span>Durdur</span>
            </button>
          )}

          {/* Close stage for remote screen share to return to chat view */}
          {!isLocal && onCloseStage && (
            <button
              type="button"
              onClick={onCloseStage}
              className={`${
                pip ? 'h-7 px-2 text-[11px]' : 'h-8 sm:h-9 px-2.5 text-xs'
              } rounded-xl bg-white/10 hover:bg-white/15 text-gray-300 hover:text-white flex items-center space-x-1 font-medium transition cursor-pointer`}
              title="Yayını Gizle (Sohbete Dön)"
            >
              <X size={pip ? 12 : 14} />
              <span className="hidden sm:inline">Kapat</span>
            </button>
          )}

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className={`${
              pip ? 'w-7 h-7' : 'w-8 sm:w-9 h-8 sm:h-9'
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
