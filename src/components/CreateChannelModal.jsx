import React, { useState } from 'react';
import { X, Hash } from 'lucide-react';

export const CreateChannelModal = ({ isOpen, onClose, onCreateChannel }) => {
  const [channelName, setChannelName] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!channelName.trim()) return;
    onCreateChannel({ name: channelName.trim(), type: 'text' });
    setChannelName('');
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 select-none"
      onClick={onClose}
    >
      <div 
        className="bg-[#0c0c0e] border border-white/10 rounded-3xl w-full max-w-md shadow-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white/[0.02] border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
              <Hash size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide text-white">
                Yeni Grup / Kanal
              </h2>
              <p className="text-[11px] text-gray-400">Mesajlaşmak ve sesli görüşme yapmak için yeni bir grup oluşturun</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition border border-white/5"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              Grup / Kanal Adı
            </label>
            <input
              type="text"
              required
              autoFocus
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              placeholder="Örn: Oyun Grubu, Proje Ekibi, Sohbet Odası"
              className="w-full bg-[#141418] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
            />
          </div>

          <div className="flex items-center justify-end space-x-2.5 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={!channelName.trim()}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition"
            >
              Grup Oluştur
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
