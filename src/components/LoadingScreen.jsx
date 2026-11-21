import React from 'react';

/**
 * Standard Voys application loading screen.
 * Displays a clean spinning indicator on the dark rounded background without inner dot.
 */
export const LoadingScreen = () => {
  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen bg-[#0c0c0e] rounded-2xl border border-white/10 text-gray-300 select-none">
      <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-indigo-500 animate-spin" />
    </div>
  );
};

export default LoadingScreen;
