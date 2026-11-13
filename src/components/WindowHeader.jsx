import React from 'react';
import {
  X,
  Minus,
  Square,
  HelpCircle
} from 'lucide-react';
import { minimizeWindow, toggleMaximizeWindow, closeWindow, openExternalUrl } from '../utils/windowManager';

export const WindowHeader = ({
  pageTitle,
  groupName = 'Voys'
}) => {
  const currentTitle = pageTitle || groupName || 'Voys';

  const handleOpenHelp = (e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    openExternalUrl('https://www.youtube.com/watch?v=ANnoNIMPWnQ');
  };

  return (
    <header
      data-tauri-drag-region
      className="h-8 bg-[#08080a] voys-glass-header border-b border-white/[0.06] flex items-center justify-between px-2.5 select-none flex-shrink-0 relative z-50"
    >
      {/* Left: Voys Brand Logo */}
      <div
        data-tauri-drag-region
        className="flex items-center pl-1"
      >
        <img
          src="/voys_logo.png"
          alt="Voys"
          draggable={false}
          className="h-[16px] w-auto object-contain select-none pointer-events-none"
        />
      </div>

      {/* Center: Active Page Title */}
      <div
        data-tauri-drag-region
        className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none max-w-[45%] sm:max-w-[55%] truncate"
      >
        <span className="text-xs font-semibold text-gray-300 tracking-wide truncate">
          {currentTitle}
        </span>
      </div>

      {/* Right: Help Button + Desktop Window Controls */}
      <div
        data-tauri-drag-region="false"
        className="flex items-center space-x-1 -mr-1"
      >
        {/* Help Button */}
        <button
          type="button"
          onClick={handleOpenHelp}
          className="w-7 h-6 flex items-center justify-center text-gray-400 hover:text-[#a36eff] hover:bg-[#8B51FF]/15 rounded transition cursor-pointer mr-1"
          title="Yardım (Rehber Videosu)"
        >
          <HelpCircle size={14} />
        </button>

        {/* Desktop Window Controls (Minimize, Maximize, Close) */}
        <button
          type="button"
          onClick={minimizeWindow}
          className="w-8 h-6 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded transition cursor-pointer"
          title="Simge Durumuna Küçült"
        >
          <Minus size={13} />
        </button>
        <button
          type="button"
          onClick={toggleMaximizeWindow}
          className="w-8 h-6 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded transition cursor-pointer"
          title="Ekranı Kapla / Geri Yükle"
        >
          <Square size={11} />
        </button>
        <button
          type="button"
          onClick={closeWindow}
          className="w-8 h-6 flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#ef4444] rounded transition cursor-pointer"
          title="Kapat"
        >
          <X size={13} />
        </button>
      </div>
    </header>
  );
};
