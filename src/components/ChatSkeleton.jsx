import React from 'react';

export const ChatSkeleton = () => {
  return (
    <div className="flex-1 px-5 py-4 space-y-5 select-none">
      {/* Skeleton Message 1 */}
      <div className="flex items-start space-x-3.5 p-2 rounded-2xl">
        <div className="w-9 h-9 bg-white/5 rounded-2xl flex-shrink-0 border border-white/5"></div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center space-x-2">
            <div className="w-24 h-3.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20"></div>
            <div className="w-20 h-2.5 bg-white/5 rounded-lg"></div>
          </div>
          <div className="w-56 h-3 bg-white/5 rounded-lg"></div>
          <div className="w-36 h-3 bg-white/5 rounded-lg"></div>
        </div>
      </div>

      {/* Skeleton Message 2 */}
      <div className="flex items-start space-x-3.5 p-2 rounded-2xl">
        <div className="w-9 h-9 bg-white/5 rounded-2xl flex-shrink-0 border border-white/5"></div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center space-x-2">
            <div className="w-28 h-3.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20"></div>
            <div className="w-16 h-2.5 bg-white/5 rounded-lg"></div>
          </div>
          <div className="w-72 h-3 bg-white/5 rounded-lg"></div>
        </div>
      </div>

      {/* Skeleton Message 3 */}
      <div className="flex items-start space-x-3.5 p-2 rounded-2xl">
        <div className="w-9 h-9 bg-white/5 rounded-2xl flex-shrink-0 border border-white/5"></div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center space-x-2">
            <div className="w-20 h-3.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20"></div>
            <div className="w-24 h-2.5 bg-white/5 rounded-lg"></div>
          </div>
          <div className="w-44 h-3 bg-white/5 rounded-lg"></div>
          <div className="w-60 h-3 bg-white/5 rounded-lg"></div>
        </div>
      </div>
    </div>
  );
};
