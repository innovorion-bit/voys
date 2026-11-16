import React, { useState } from 'react';
import {
  X,
  Monitor,
  Zap,
  Sliders,
  Sparkles,
  Volume2,
  Check,
  Gamepad2,
  Tv
} from 'lucide-react';

export const ScreenShareModal = ({
  isOpen,
  onClose,
  onStartShare,
}) => {
  const [resolution, setResolution] = useState('1080p');
  const [fps, setFps] = useState(30);
  const [includeAudio, setIncludeAudio] = useState(true);

  if (!isOpen) return null;

  const resolutionOptions = [
    {
      id: '720p',
      label: '720p HD',
      desc: 'Düşük veri & en düşük gecikme',
      res: '1280x720',
    },
    {
      id: '1080p',
      label: '1080p Full HD',
      desc: 'Önerilen · Net ve dengeli',
      res: '1920x1080',
      badge: 'Önerilen',
    },
    {
      id: '1440p',
      label: '1440p 2K',
      desc: 'Yüksek çözünürlük & netlik',
      res: '2560x1440',
    },
    {
      id: 'source',
      label: 'Kaynak',
      desc: 'Ekranın doğal çözünürlüğü',
      res: 'Orijinal',
    },
  ];

  const fpsOptions = [
    {
      value: 15,
      label: '15 FPS',
      desc: 'Metin & Kod okuma için ideal',
    },
    {
      value: 30,
      label: '30 FPS',
      desc: 'Standart akıcı yayın',
      badge: 'Dengeli',
    },
    {
      value: 60,
      label: '60 FPS',
      desc: 'Oyunlar & Akıcı animasyonlar',
      badge: 'Oyun',
      icon: Gamepad2,
    },
  ];

  const handleApplyPreset = (presetRes, presetFps) => {
    setResolution(presetRes);
    setFps(presetFps);
  };

  const handleStart = () => {
    onStartShare({
      resolution,
      fps: Number(fps),
      includeAudio,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-lg bg-[#111217] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-gray-200 animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="screen-share-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-[#16171e]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#8B51FF]/20 border border-[#8B51FF]/30 flex items-center justify-center text-[#c084fc] shadow-lg shadow-[#8B51FF]/10">
              <Monitor size={20} />
            </div>
            <div>
              <h2
                id="screen-share-modal-title"
                className="text-base font-bold text-white tracking-tight"
              >
                Ekran Paylaşımı Kalitesi
              </h2>
              <p className="text-xs text-gray-400">
                Yayınınızın çözünürlük ve kare hızını (FPS) seçin
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
            title="Kapat"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Quick Presets Bar */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2 flex items-center space-x-1.5">
              <Zap size={13} className="text-[#a855f7]" />
              <span>Hızlı Önayarlar</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleApplyPreset('720p', 15)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border transition text-left flex flex-col cursor-pointer ${
                  resolution === '720p' && fps === 15
                    ? 'bg-[#8B51FF]/20 border-[#8B51FF]/60 text-white shadow-sm shadow-[#8B51FF]/20'
                    : 'bg-[#181922] border-white/5 hover:border-white/15 text-gray-300'
                }`}
              >
                <span className="font-bold flex items-center justify-between">
                  Performans
                  {resolution === '720p' && fps === 15 && <Check size={12} className="text-[#c084fc]" />}
                </span>
                <span className="text-[10px] text-gray-400 font-mono mt-0.5">720p · 15 FPS</span>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset('1080p', 30)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border transition text-left flex flex-col cursor-pointer ${
                  resolution === '1080p' && fps === 30
                    ? 'bg-[#8B51FF]/20 border-[#8B51FF]/60 text-white shadow-sm shadow-[#8B51FF]/20'
                    : 'bg-[#181922] border-white/5 hover:border-white/15 text-gray-300'
                }`}
              >
                <span className="font-bold flex items-center justify-between">
                  Dengeli
                  {resolution === '1080p' && fps === 30 && <Check size={12} className="text-[#c084fc]" />}
                </span>
                <span className="text-[10px] text-gray-400 font-mono mt-0.5">1080p · 30 FPS</span>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset('1080p', 60)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border transition text-left flex flex-col cursor-pointer ${
                  resolution === '1080p' && fps === 60
                    ? 'bg-[#8B51FF]/20 border-[#8B51FF]/60 text-white shadow-sm shadow-[#8B51FF]/20'
                    : 'bg-[#181922] border-white/5 hover:border-white/15 text-gray-300'
                }`}
              >
                <span className="font-bold flex items-center justify-between">
                  Oyun Modu
                  {resolution === '1080p' && fps === 60 && <Check size={12} className="text-[#c084fc]" />}
                </span>
                <span className="text-[10px] text-gray-400 font-mono mt-0.5">1080p · 60 FPS</span>
              </button>
            </div>
          </div>

          {/* Çözünürlük (Resolution) Selection */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2 flex items-center space-x-1.5">
              <Tv size={13} className="text-[#a855f7]" />
              <span>Yayın Çözünürlüğü</span>
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {resolutionOptions.map((opt) => {
                const isSelected = resolution === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setResolution(opt.id)}
                    className={`relative p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#8B51FF]/15 border-[#8B51FF] text-white shadow-md shadow-[#8B51FF]/10'
                        : 'bg-[#181922] border-white/5 hover:border-white/15 text-gray-300 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-white">{opt.label}</span>
                      {opt.badge && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#8B51FF]/30 text-[#d8b4fe] border border-[#8B51FF]/40">
                          {opt.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 leading-tight">{opt.desc}</span>
                    <span className="text-[10px] font-mono text-gray-500 mt-2">{opt.res}</span>
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#8B51FF] flex items-center justify-center text-white">
                        <Check size={10} strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Kare Hızı (FPS) Selection */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2 flex items-center space-x-1.5">
              <Sliders size={13} className="text-[#a855f7]" />
              <span>Kare Hızı (FPS)</span>
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {fpsOptions.map((opt) => {
                const isSelected = fps === opt.value;
                const IconComponent = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFps(opt.value)}
                    className={`relative p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#8B51FF]/15 border-[#8B51FF] text-white shadow-md shadow-[#8B51FF]/10'
                        : 'bg-[#181922] border-white/5 hover:border-white/15 text-gray-300 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-1">
                        {IconComponent && <IconComponent size={13} className="text-[#c084fc]" />}
                        <span className="font-bold text-sm text-white">{opt.label}</span>
                      </div>
                    </div>
                    <span className="text-[11px] text-gray-400 leading-tight mt-1">{opt.desc}</span>
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#8B51FF] flex items-center justify-center text-white">
                        <Check size={10} strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sistem Sesi Toggle */}
          <div className="p-3.5 rounded-xl bg-[#181922] border border-white/5 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-300">
                <Volume2 size={16} />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Sistem Sesini Paylaş</p>
                <p className="text-[11px] text-gray-400">Oyun ve uygulama seslerini odaya ilet</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={includeAudio}
                onChange={(e) => setIncludeAudio(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#8B51FF]" />
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.08] bg-[#14151b]">
          <div className="flex items-center space-x-1.5 text-xs text-gray-400 font-mono">
            <Sparkles size={13} className="text-[#c084fc]" />
            <span>
              Seçim: <strong className="text-white">{resolution === 'source' ? 'Kaynak' : resolution} · {fps} FPS</strong>
            </span>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-gray-300 transition cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={handleStart}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-[#8B51FF] hover:bg-[#7c3aed] text-white shadow-lg shadow-[#8B51FF]/30 hover:shadow-[#8B51FF]/50 transition flex items-center space-x-1.5 cursor-pointer active:scale-95"
            >
              <Monitor size={14} />
              <span>Yayını Başlat</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
