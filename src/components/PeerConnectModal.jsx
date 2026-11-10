import React, { useState } from 'react';
import { X, Copy, Check, Radio, Users, PhoneCall, ShieldCheck } from 'lucide-react';

export const PeerConnectModal = ({ 
  isOpen, 
  onClose, 
  myPeerId, 
  connectedPeers = [],
  onCallPeer 
}) => {
  const [peerIdInput, setPeerIdInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [isCalling, setIsCalling] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!myPeerId) return;
    navigator.clipboard.writeText(myPeerId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConnect = async (e) => {
    e.preventDefault();
    if (!peerIdInput.trim()) return;
    setIsCalling(true);
    try {
      await onCallPeer(peerIdInput.trim());
      setPeerIdInput('');
    } finally {
      setIsCalling(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 p-4 select-none animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-[#0c0c0e]/95 backdrop-blur-2xl border border-white/10 rounded-3xl w-full max-w-md p-6 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8),0_0_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col space-y-4 text-xs text-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
              <Radio size={18} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                WebRTC Canlı Bağlantı
              </h2>
              <p className="text-[11px] text-gray-400">Doğrudan eşler arası (P2P) ses köprüsü</p>
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

        {/* Content */}
        <div className="space-y-4">
          {/* My Peer ID Box */}
          <div className="bg-white/[0.02] p-4 rounded-2xl border border-white/5 space-y-2">
            <div className="text-[11px] font-semibold text-gray-400 flex items-center justify-between uppercase tracking-wider">
              <span>SENİN PEER KİMLİĞİN (ID)</span>
              <span className="text-emerald-400 flex items-center gap-1 font-mono text-[11px]">
                <ShieldCheck size={13} /> PeerJS Aktif
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={myPeerId || 'Kimlik alınıyor...'}
                className="flex-1 bg-[#141418] text-white font-mono text-xs px-3.5 py-2 rounded-xl border border-white/10 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopy}
                disabled={!myPeerId}
                className="px-3.5 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded-xl text-xs font-semibold border border-indigo-500/30 flex items-center gap-1.5 transition active:scale-95 flex-shrink-0"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copied ? 'Kopyalandı' : 'Kopyala'}</span>
              </button>
            </div>
            <p className="text-[11px] text-gray-500">
              İkinci bir tarayıcı sekmesi açıp bu kimliği girerek gerçek zamanlı 2 yönlü sesli konuşmayı test edebilirsiniz.
            </p>
          </div>

          {/* Connect to Another Peer Form */}
          <form onSubmit={handleConnect} className="space-y-2">
            <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider">
              BAŞKA BİR KULLANICIYA DOĞRUDAN BAĞLAN
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={peerIdInput}
                onChange={(e) => setPeerIdInput(e.target.value)}
                placeholder="Arkadaşının Peer ID'sini yapıştır..."
                className="flex-1 bg-[#141418] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
              />
              <button
                type="submit"
                disabled={!peerIdInput.trim() || isCalling}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition disabled:opacity-50 flex-shrink-0"
              >
                <PhoneCall size={14} />
                <span>{isCalling ? 'Bağlanıyor...' : 'Bağlan'}</span>
              </button>
            </div>
          </form>

          {/* Active Peer Connections */}
          <div className="pt-3 border-t border-white/10">
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="flex items-center gap-1.5 font-semibold text-[11px] uppercase tracking-wider">
                <Users size={13} className="text-indigo-400" />
                <span>Aktif WebRTC Bağlantıları ({connectedPeers.length})</span>
              </span>
            </div>

            {connectedPeers.length === 0 ? (
              <div className="text-center py-4 text-xs text-gray-500 bg-white/[0.02] rounded-xl border border-white/5">
                Henüz doğrudan bağlı harici peer yok.
              </div>
            ) : (
              <div className="space-y-1.5">
                {connectedPeers.map((id) => (
                  <div key={id} className="flex items-center justify-between bg-white/[0.03] px-3.5 py-2 rounded-xl border border-white/5">
                    <span className="font-mono text-gray-200 text-xs">{id}</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-white/10 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-xs font-semibold border border-white/10 transition"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
