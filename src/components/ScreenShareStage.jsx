import React, { useRef, useEffect, useState } from 'react';
import { 
  Maximize2, 
  Minimize2, 
  PictureInPicture2, 
  Monitor, 
  MonitorX, 
  Radio, 
  Volume2, 
  VolumeX,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

export const ScreenShareStage = ({
  activeScreenShare = null,
  onStopScreenShare,
}) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPipMode, setIsPipMode] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

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
  const streamerName = activeScreenShare.userName || (isLocal ? 'Sen (You)' : 'Kullanıcı');

  return (
    <div
      ref={containerRef}
      className={`transition-all duration-300 ease-in-out select-none ${
        isPipMode
          ? 'absolute top-14 right-4 z-40 w-72 sm:w-88 md:w-96 shadow-xl border border-white/10 rounded-2xl overflow-hidden bg-[#0c0c0e]'
          : 'relative w-full border-b border-white/5 bg-[#08080a] flex-shrink-0'
      }`}
    >
      {/* Stage Header Overlay Bar */}
      <div className="px-3.5 py-2 bg-[#0c0c0e] border-b border-white/5 flex items-center justify-between text-xs text-gray-200 z-10 relative">
        <div className="flex items-center space-x-2.5 min-w-0">
          {/* Live badge */}
          <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold tracking-wider flex-shrink-0">
            <Radio size={10} />
            <span>CANLI</span>
          </span>

          {/* Streamer details */}
          <div className="flex items-center space-x-1.5 truncate">
            <Monitor size={14} className="text-indigo-400 flex-shrink-0" />
            <span className="font-semibold text-gray-100 truncate">
              {isLocal ? 'Ekranını Paylaşıyorsun' : `${streamerName} Ekranı`}
            </span>
            <span className="text-[10px] text-gray-400 font-mono hidden sm:inline bg-white/5 px-1.5 py-0.5 rounded">
              1080p HD
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1 flex-shrink-0">
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
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition"
              title={isMuted ? "Sesi Aç" : "Sesi Kapat"}
            >
              {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} className="text-emerald-400" />}
            </button>
          )}

          {/* Collapse/Expand Toggle (In banner mode) */}
          {!isPipMode && (
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition"
              title={isCollapsed ? "Genişlet" : "Daralt"}
            >
              {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          )}

          {/* Picture-in-Picture / Floating mode toggle */}
          <button
            type="button"
            onClick={() => {
              setIsPipMode(!isPipMode);
              setIsCollapsed(false);
            }}
            className={`p-1.5 rounded-lg transition ${
              isPipMode 
                ? 'text-indigo-300 bg-indigo-600/20 border border-indigo-500/30' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
            title={isPipMode ? "Üst Panel Görünümüne Geç" : "Kayan Pencere (PiP) Yap"}
          >
            <PictureInPicture2 size={14} />
          </button>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition"
            title={isFullscreen ? "Tam Ekrandan Çık" : "Tam Ekran Yap"}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          {/* Stop Stream Button (If local user) */}
          {isLocal && onStopScreenShare && (
            <button
              type="button"
              onClick={onStopScreenShare}
              className="ml-1 px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[11px] font-bold rounded-lg transition flex items-center space-x-1 shadow-sm active:scale-95"
              title="Ekran Paylaşımını Sonlandır"
            >
              <MonitorX size={12} />
              <span>Durdur</span>
            </button>
          )}
        </div>
      </div>

      {/* Video Stream Stage */}
      {!isCollapsed && (
        <div
          className={`relative bg-black flex items-center justify-center overflow-hidden transition-all ${
            isPipMode
              ? 'h-44 sm:h-52 w-full'
              : 'h-56 sm:h-72 md:h-80 lg:h-92 w-full'
          }`}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isLocal || isMuted}
            className="w-full h-full object-contain bg-black"
          />

          {/* Watermark in bottom corner */}
          <div className="absolute bottom-2 right-2 bg-black/75 px-2 py-0.5 rounded-md text-[9px] font-mono text-gray-400 pointer-events-none border border-white/5">
            Voys Screen Link • P2P
          </div>
        </div>
      )}
    </div>
  );
};
