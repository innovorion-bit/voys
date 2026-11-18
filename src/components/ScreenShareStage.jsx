import React, { useRef, useEffect, useState } from 'react';
import { 
  Maximize2, 
  Minimize2, 
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
      </div>

      {/* Stage Bottom Controls (Cleaned up: divider line and box background removed) */}
      <div
        className={`flex items-center justify-end ${
          pip ? 'px-2.5 py-1.5' : 'px-4 py-3'
        } z-10 flex-shrink-0 select-none space-x-2`}
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
  );
};
