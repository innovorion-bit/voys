import React, { useRef, useEffect, useState } from 'react';
import { 
  Maximize2, 
  Minimize2, 
  PictureInPicture2, 
  MonitorX, 
  Volume2, 
  VolumeX
} from 'lucide-react';

export const ScreenShareStage = ({
  activeScreenShare = null,
  onStopScreenShare,
  isPipMode = false,
  onTogglePip,
}) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  
  const [isMuted, setIsMuted] = useState(true);
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
      videoRef.current.play().catch((err) => {
        console.warn('Video autoPlay prevented or stream ended:', err);
      });
    }
  }, [activeScreenShare?.stream]);

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

  return (
    <div
      ref={containerRef}
      className={`transition-all duration-300 ease-in-out select-none ${
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

        {/* Quality Badge (Moved to top-left of video stage as requested) */}
        {activeScreenShare?.qualityLabel && (
          <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 text-[10px] sm:text-[11px] font-mono text-gray-300 pointer-events-none select-none z-10 flex items-center space-x-1.5 shadow-md">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{activeScreenShare.qualityLabel}</span>
          </div>
        )}
      </div>

      {/* Stage Bottom Controls Bar (Cleaned up: CANLI and Streamer Name removed, right-aligned controls) */}
      <div
        className={`${
          pip ? 'h-11 px-2.5' : 'h-14 px-4'
        } bg-[#0a0a0d] border-t border-white/10 flex items-center justify-end z-10 flex-shrink-0 select-none space-x-1.5 sm:space-x-2`}
      >
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

        {/* Picture-in-Picture / Floating Mode Toggle */}
        <button
          type="button"
          onClick={() => setPip(!pip)}
          className={`${
            pip ? 'w-7 h-7 text-[#c084fc] bg-[#8B51FF]/20 border border-[#8B51FF]/40' : 'w-9 h-9 text-gray-300 hover:text-white bg-white/5 hover:bg-white/10'
          } rounded-xl flex items-center justify-center transition cursor-pointer`}
          title={pip ? "Sohbet Alanına Genişlet" : "Kayan Pencere (PiP) Yap"}
        >
          <PictureInPicture2 size={pip ? 13 : 16} />
        </button>

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

        {/* Stop Stream Button (If local user) */}
        {isLocal && onStopScreenShare && (
          <button
            type="button"
            onClick={onStopScreenShare}
            className={`${
              pip ? 'h-7 px-2 text-[11px]' : 'h-9 px-3.5 text-xs'
            } bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 hover:text-rose-200 border border-rose-500/30 font-semibold rounded-xl transition flex items-center space-x-1.5 shadow-sm active:scale-95 cursor-pointer ml-1`}
            title="Ekran Paylaşımını Sonlandır"
          >
            <MonitorX size={pip ? 12 : 14} />
            <span>Durdur</span>
          </button>
        )}
      </div>
    </div>
  );
};
