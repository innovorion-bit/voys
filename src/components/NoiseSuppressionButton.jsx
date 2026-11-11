import React from 'react';
import { AudioLines } from 'lucide-react';
import { useSettings } from '../context/useSettings';
import { NOISE_SUPPRESSION_MODES, normalizeNoiseSuppressionMode } from '../utils/noiseSuppressionPipeline';

const VARIANT_CLASSES = {
  'icon-sm': {
    base: 'relative w-8 h-8 flex items-center justify-center rounded-lg transition active:scale-95 cursor-pointer',
    active: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/35 hover:bg-emerald-500/30',
    inactive: 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-transparent',
    iconSize: 15,
  },
  sidebar: {
    base: 'relative w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-xl transition active:scale-95 cursor-pointer border',
    active: 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border-emerald-500/35 shadow-sm shadow-emerald-500/10',
    inactive: 'bg-[#1a1c26] hover:bg-[#222534] text-gray-400 hover:text-white border-white/10',
    iconSize: 14,
  },
  'icon-lg': {
    base: 'relative w-12 h-12 rounded-2xl flex items-center justify-center transition active:scale-95 cursor-pointer border',
    active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30 shadow-sm',
    inactive: 'bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border-white/10',
    iconSize: 18,
  },
  stage: {
    base: 'px-3 h-10 rounded-full flex items-center space-x-1.5 transition-all text-xs font-bold cursor-pointer',
    active: 'bg-[#153423] text-[#22c55e] border border-[#22c55e]/40 shadow-[0_0_15px_rgba(34,197,94,0.25)]',
    inactive: 'bg-[#1a1a22] text-gray-400 hover:text-white border border-transparent',
    iconSize: 14,
  },
};

export const NoiseSuppressionButton = ({ variant = 'icon-sm', className = '' }) => {
  const { aiNoiseSuppression, noiseSuppressionMode, toggleAiNoiseSuppression } = useSettings();
  const safeMode = normalizeNoiseSuppressionMode(noiseSuppressionMode);
  const modeInfo = NOISE_SUPPRESSION_MODES[safeMode];
  const isAggressive = safeMode === 'aggressive';
  const styles = VARIANT_CLASSES[variant] || VARIANT_CLASSES['icon-sm'];

  const title = aiNoiseSuppression
    ? `Gürültü Engelleme Açık (${modeInfo.label}) — Kapatmak için tıkla`
    : 'Gürültü Engelleme Kapalı — Yapay Zeka filtresini açmak için tıkla';

  return (
    <button
      type="button"
      onClick={toggleAiNoiseSuppression}
      aria-pressed={aiNoiseSuppression}
      title={title}
      className={`${styles.base} ${aiNoiseSuppression ? styles.active : styles.inactive} ${className}`.trim()}
    >
      <AudioLines
        size={styles.iconSize}
        className={variant === 'stage' ? (aiNoiseSuppression ? 'text-[#22c55e]' : 'text-gray-400') : ''}
      />
      {variant === 'stage' ? (
        <span>{aiNoiseSuppression && isAggressive ? 'AI NS+' : 'AI NS'}</span>
      ) : (
        aiNoiseSuppression && (
          <span
            className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${
              isAggressive ? 'bg-amber-400' : 'bg-emerald-400'
            }`}
          />
        )
      )}
    </button>
  );
};
