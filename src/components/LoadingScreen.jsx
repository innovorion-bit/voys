import React from 'react';
import { isTauriEnvironment } from '../utils/windowManager';

/**
 * Standard Voys application loading screen.
 * Displays a clean spinning indicator without inner dot.
 * In desktop Tauri, renders directly as a single rounded container so that the window's
 * native transparency seamlessly cuts the corners with zero square background artifacts.
 */
export const LoadingScreen = () => {
  const isTauri = isTauriEnvironment();

  if (isTauri) {
    return (
      <div
        data-tauri-drag-region
        className="flex items-center justify-center h-screen w-screen bg-[#0c0c0e] rounded-2xl border border-white/10 shadow-2xl select-none cursor-default overflow-hidden relative"
      >
        <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-[#8B51FF] animate-spin pointer-events-none" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full bg-[#070709] select-none cursor-default overflow-hidden p-4">
      <div className="w-full max-w-[380px] h-[400px] flex items-center justify-center bg-[#0c0c0e] rounded-2xl border border-white/10 shadow-2xl relative">
        <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-[#8B51FF] animate-spin pointer-events-none" />
      </div>
    </div>
  );
};

export default LoadingScreen;
