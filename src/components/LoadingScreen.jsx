import React from 'react';

/**
 * Standard Voys application loading screen.
 * Displays a clean spinning indicator on the dark rounded background without inner dot.
 */
export const LoadingScreen = () => {
  return (
    <div
      data-tauri-drag-region
      className="flex flex-col items-center justify-center h-screen w-screen bg-[#070709] select-none cursor-default overflow-hidden"
    >
      <div
        data-tauri-drag-region
        className="w-full h-full max-w-[380px] max-h-[400px] flex items-center justify-center bg-[#0c0c0e] rounded-2xl border border-white/10 shadow-2xl relative"
      >
        <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-[#8B51FF] animate-spin pointer-events-none" />
      </div>
    </div>
  );
};

export default LoadingScreen;
