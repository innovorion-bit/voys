import React from 'react';

/**
 * ConnectionQualityIndicator Component
 * Displays WebRTC round-trip time (RTT / Ping in ms) with dynamic 4-bar cellular signal indicators.
 * Color scales:
 *  - 0-80ms: Emerald (Mükemmel / Excellent)
 *  - 81-150ms: Amber (Orta / Fair)
 *  - 151ms+: Rose/Red (Yüksek Gecikme / Poor)
 */
export const ConnectionQualityIndicator = ({
  ping = 24,
  showValue = true,
  className = '',
}) => {
  const safePing = typeof ping === 'number' && ping > 0 ? Math.round(ping) : 24;

  let qualityText = 'Mükemmel';
  let colorClass = 'text-emerald-400';
  let barColor = 'bg-emerald-400';
  let activeBars = 4;

  if (safePing > 150) {
    qualityText = 'Yüksek Gecikme';
    colorClass = 'text-rose-400';
    barColor = 'bg-rose-400';
    activeBars = 1;
  } else if (safePing > 80) {
    qualityText = 'Normal';
    colorClass = 'text-amber-400';
    barColor = 'bg-amber-400';
    activeBars = safePing > 120 ? 2 : 3;
  } else {
    activeBars = 4;
  }

  // 4 progressive bar heights
  const barHeights = ['h-1', 'h-1.5', 'h-2.5', 'h-3.5'];

  return (
    <div
      className={`group/ping relative inline-flex items-center space-x-1.5 px-1 py-0.5 rounded cursor-default select-none transition-colors hover:bg-white/5 ${className}`}
      title={`WebRTC P2P Gecikme (RTT): ${safePing}ms (${qualityText})`}
    >
      {/* 4-Bar Cellular Signal Indicator */}
      <div className="flex items-end space-x-[2px] h-3.5 flex-shrink-0" aria-label={`Bağlantı Sinyali: ${activeBars}/4`}>
        {barHeights.map((hClass, idx) => {
          const isActive = idx < activeBars;
          return (
            <span
              key={idx}
              className={`w-[2.5px] rounded-full transition-all duration-300 ${hClass} ${
                isActive ? barColor : 'bg-white/15'
              }`}
            />
          );
        })}
      </div>

      {/* Ping numerical display */}
      {showValue && (
        <span className={`text-[10px] font-mono font-medium tracking-tight ${colorClass}`}>
          {safePing}ms
        </span>
      )}

      {/* Sleek Midnight Tooltip on Hover */}
      <div className="absolute right-0 bottom-full mb-1.5 hidden group-hover/ping:flex flex-col items-center pointer-events-none z-50 animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-[#15182a] border border-white/10 text-white text-[10px] rounded-lg px-2.5 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.5)] whitespace-nowrap space-y-0.5">
          <div className="flex items-center space-x-1.5 font-bold">
            <span className={`w-1.5 h-1.5 rounded-full ${barColor}`} />
            <span className={colorClass}>{safePing} ms</span>
            <span className="text-gray-300">• {qualityText}</span>
          </div>
          <div className="text-[9px] text-gray-400 flex items-center justify-between space-x-2">
            <span>WebRTC RTT (getStats)</span>
            <span className="text-gray-500 font-mono">P2P Mesh</span>
          </div>
        </div>
        <div className="w-2 h-2 bg-[#15182a] border-r border-b border-white/10 rotate-45 -mt-1" />
      </div>
    </div>
  );
};
