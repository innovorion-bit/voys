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
  const [isWaitingSelection, setIsWaitingSelection] = useState(false);

  if (!isOpen) return null;

  const handleStart = async () => {
    setIsWaitingSelection(true);
    try {
      const stream = await onStartShare({
        resolution,
        fps: Number(fps),
        includeAudio,
      });
      if (stream) {
        onClose();
      }
    } catch {
      //
    } finally {
      setIsWaitingSelection(false);
    }
  };

  const resolutionList = [
    { id: '720p', label: '720p HD' },
    { id: '1080p', label: '1080p Full HD' },
    { id: '1440p', label: '1440p 2K' },
    { id: 'source', label: 'Kaynak' },
  ];

  const fpsList = [
    { value: 15, label: '15 FPS' },
    { value: 30, label: '30 FPS' },
    { value: 60, label: '60 FPS' },
  ];

  if (isWaitingSelection) {
    return (
      <div className="absolute inset-0 z-30 bg-[#0b0c10] flex flex-col items-center justify-center p-6 text-gray-200 select-none">
        <div className="max-w-md w-full bg-[#121319] border border-white/10 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
          <div className="w-10 h-10 rounded-xl bg-[#8B51FF]/20 border border-[#8B51FF]/30 flex items-center justify-center mx-auto text-[#c084fc]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#8B51FF] animate-ping"></span>
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">Ekran Seçimi Bekleniyor</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Açılan tarayıcı penceresinden yayınlamak istediğiniz ekranı veya uygulama penceresini seçin.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsWaitingSelection(false);
              onClose();
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-gray-300 transition cursor-pointer"
          >
            Vazgeç
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-30 bg-[#0b0c10] flex flex-col justify-between text-gray-200 select-none overflow-y-auto">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#101116] flex-shrink-0">
        <div>
          <h2 className="text-sm font-bold text-white tracking-wide">Ekran Paylaşımı</h2>
          <p className="text-xs text-gray-400">Yayın çözünürlük ve kare hızı (FPS) ayarlarını seçin</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 cursor-pointer transition"
          title="Kapat"
        >
          <X size={18} />
        </button>
      </div>

      {/* Main Content (Centered) */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-xl mx-auto space-y-6">
        {/* Çözünürlük */}
        <div className="w-full space-y-2">
          <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block">
            Çözünürlük
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {resolutionList.map((opt) => {
              const isSelected = resolution === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setResolution(opt.id)}
                  className={`py-3 px-3 rounded-xl text-xs font-semibold border transition cursor-pointer text-center ${
                    isSelected
                      ? 'bg-[#8B51FF] border-[#8B51FF] text-white shadow-lg shadow-[#8B51FF]/25'
                      : 'bg-[#15161d] border-white/5 hover:border-white/15 text-gray-300 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Kare Hızı (FPS) */}
        <div className="w-full space-y-2">
          <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block">
            Kare Hızı (FPS)
          </label>
          <div className="grid grid-cols-3 gap-2">
            {fpsList.map((opt) => {
              const isSelected = fps === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFps(opt.value)}
                  className={`py-3 px-3 rounded-xl text-xs font-semibold border transition cursor-pointer text-center ${
                    isSelected
                      ? 'bg-[#8B51FF] border-[#8B51FF] text-white shadow-lg shadow-[#8B51FF]/25'
                      : 'bg-[#15161d] border-white/5 hover:border-white/15 text-gray-300 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sistem Sesi */}
        <div className="w-full p-3.5 rounded-xl bg-[#15161d] border border-white/5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-white">Sistem Sesi</p>
            <p className="text-[11px] text-gray-400">Oyun ve uygulama seslerini odaya ilet</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={includeAudio}
              onChange={(e) => setIncludeAudio(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-white/10 accent-[#8B51FF] cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* Footer Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-[#101116] flex-shrink-0">
        <div className="text-xs text-gray-400">
          Seçim: <strong className="text-white">{resolution === 'source' ? 'Kaynak' : resolution} · {fps} FPS</strong>
        </div>
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleStart}
            className="px-6 py-2 rounded-xl text-xs font-bold bg-[#8B51FF] hover:bg-[#7c3aed] text-white shadow-lg shadow-[#8B51FF]/30 transition cursor-pointer"
          >
            Yayını Başlat
          </button>
        </div>
      </div>
    </div>
  );
};
