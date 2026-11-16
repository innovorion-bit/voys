import React, { useState } from 'react';
import { X } from 'lucide-react';

export const ScreenShareModal = ({
  isOpen,
  onClose,
  onStartShare,
}) => {
  const [resolution, setResolution] = useState('1080p');
  const [fps, setFps] = useState(30);
  const [includeAudio, setIncludeAudio] = useState(true);

  if (!isOpen) return null;

  const handleStart = () => {
    onStartShare({
      resolution,
      fps: Number(fps),
      includeAudio,
    });
    onClose();
  };

  const resolutionList = [
    { id: '720p', label: '720p' },
    { id: '1080p', label: '1080p' },
    { id: '1440p', label: '1440p' },
    { id: 'source', label: 'Kaynak' },
  ];

  const fpsList = [15, 30, 60];

  return (
    <div className="bg-[#121319] border-b border-white/10 px-4 py-3 flex-shrink-0 text-gray-200 select-none">
      <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-white/5">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-white">Ekran Paylaşımı</span>
          <span className="text-[11px] text-gray-400">Yayın kalitesini seçin</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-white/10 cursor-pointer"
          title="Kapat"
        >
          <X size={15} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        {/* Çözünürlük */}
        <div className="flex items-center space-x-2">
          <span className="text-gray-400 text-xs">Çözünürlük:</span>
          <div className="inline-flex rounded-lg bg-[#181920] p-0.5 border border-white/5">
            {resolutionList.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setResolution(opt.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer ${
                  resolution === opt.id
                    ? 'bg-[#8B51FF] text-white font-semibold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Kare Hızı (FPS) */}
        <div className="flex items-center space-x-2">
          <span className="text-gray-400 text-xs">FPS:</span>
          <div className="inline-flex rounded-lg bg-[#181920] p-0.5 border border-white/5">
            {fpsList.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFps(f)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer ${
                  fps === f
                    ? 'bg-[#8B51FF] text-white font-semibold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Ses Paylaşımı */}
        <label className="flex items-center space-x-1.5 text-xs text-gray-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeAudio}
            onChange={(e) => setIncludeAudio(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-white/20 bg-white/10 accent-[#8B51FF] cursor-pointer"
          />
          <span>Sistem Sesi</span>
        </label>

        {/* Aksiyon Butonları */}
        <div className="flex items-center space-x-2 ml-auto">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleStart}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#8B51FF] hover:bg-[#7c3aed] text-white cursor-pointer"
          >
            Yayını Başlat
          </button>
        </div>
      </div>
    </div>
  );
};
