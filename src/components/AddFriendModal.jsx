import React, { useState, useEffect } from 'react';
import { 
  X, 
  UserPlus, 
  Search, 
  Check, 
  Clock, 
  Inbox, 
  Send,
  Loader2,
  Copy
} from 'lucide-react';
import { toast } from 'sonner';
import { UserAvatar } from './UserAvatar';
import { dbService } from '../lib/supabase';

export const AddFriendModal = ({ 
  isOpen, 
  onClose, 
  currentUser,
  onFriendshipUpdated,
  incomingRequests = [],
  outgoingRequests = []
}) => {
  const [activeTab, setActiveTab] = useState('search'); // 'search' | 'incoming' | 'outgoing'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    if (!val.trim() || val.length < 2) {
      setSearchResults([]);
    }
  };

  // Auto search with debounce
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const results = await dbService.searchUsers(searchQuery, currentUser?.id);
        setSearchResults(results || []);
      } catch (err) {
        console.warn('Search users error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, currentUser?.id]);

  // ESC key listener to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSendRequest = async (targetUserId, targetName) => {
    try {
      setIsSending(true);
      await dbService.sendFriendRequest(currentUser?.id, targetUserId);
      toast.success('Arkadaşlık İsteği Gönderildi', {
        description: `${targetName || 'Kullanıcı'} kullanıcısına istek iletildi.`,
      });
      setSearchQuery('');
      setSearchResults([]);
      onFriendshipUpdated?.();
      setActiveTab('outgoing');
    } catch (err) {
      toast.error('İstek Gönderilemedi', {
        description: err.message || 'Bir hata oluştu.',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleAccept = async (friendshipId, friendName) => {
    try {
      setActionLoadingId(friendshipId);
      await dbService.acceptFriendRequest(friendshipId);
      toast.success('Arkadaşlık İsteği Kabul Edildi', {
        description: `${friendName || 'Kullanıcı'} artık arkadaş listenizde!`,
      });
      onFriendshipUpdated?.();
    } catch (err) {
      toast.error('Hata Oluştu', { description: err.message });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (friendshipId) => {
    try {
      setActionLoadingId(friendshipId);
      await dbService.rejectFriendRequest(friendshipId);
      toast.info('İstek Kaldırıldı');
      onFriendshipUpdated?.();
    } catch (err) {
      toast.error('Hata Oluştu', { description: err.message });
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 top-8 z-40 bg-[#08080a] flex flex-col w-full text-gray-200 select-none animate-in fade-in duration-150">
      {/* Fullscreen Header with Window Drag Region */}
      <div 
        data-tauri-drag-region
        className="h-14 px-6 md:px-8 border-b border-white/5 bg-[#0c0c0e] flex items-center justify-between flex-shrink-0"
      >
        <div className="flex items-center space-x-3 pointer-events-none">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
            <UserPlus size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide uppercase">Arkadaş Ekle & İstekler</h2>
            <p className="text-[11px] text-gray-400">Voys kullanıcılarını bulun ve bağlantı kurun</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition border border-white/10 group shadow-sm"
          title="Kapat (ESC)"
        >
          <span className="text-xs font-medium">Kapat</span>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white/10 rounded text-gray-400 group-hover:text-white border border-white/10">ESC</kbd>
          <X size={15} />
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center px-6 md:px-8 py-2.5 border-b border-white/5 space-x-2 text-xs bg-white/[0.01] flex-shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('search')}
            className={`px-3.5 py-1.5 rounded-xl font-medium transition flex items-center space-x-2 ${
              activeTab === 'search'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-sm font-semibold'
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <UserPlus size={13} />
            <span>Arkadaş Ara & Ekle</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('incoming')}
            className={`px-3.5 py-1.5 rounded-xl font-medium transition flex items-center space-x-2 ${
              activeTab === 'incoming'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-sm font-semibold'
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Inbox size={13} />
            <span>Gelen İstekler</span>
            {incomingRequests.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-indigo-500 text-white rounded-full text-[10px] font-bold">
                {incomingRequests.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('outgoing')}
            className={`px-3.5 py-1.5 rounded-xl font-medium transition flex items-center space-x-2 ${
              activeTab === 'outgoing'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-sm font-semibold'
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Clock size={13} />
            <span>Gönderilenler</span>
            {outgoingRequests.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-white/10 text-gray-300 rounded-full text-[10px] font-bold">
                {outgoingRequests.length}
              </span>
            )}
          </button>
        </div>

      {/* Main Fullscreen Body */}
      <div className="flex-1 h-full overflow-y-auto bg-[#08080a]">
        <div className="max-w-2xl mx-auto p-6 md:p-8 space-y-6">
          {/* TAB 1: Search & Add Friend */}
          {activeTab === 'search' && (
            <div className="space-y-4">
              {/* My Personal Username & Tag Banner */}
              <div className="p-3.5 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 flex items-center justify-between">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0">
                    <UserPlus size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                      Senin Kullanıcı Adın
                    </div>
                    <div className="text-xs font-mono font-bold text-indigo-300 truncate">
                      @{currentUser?.username || 'kullanici'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const text = `@${currentUser?.username || 'kullanici'}`;
                    navigator.clipboard?.writeText(text);
                    toast.success('Kullanıcı Adı Kopyalandı', { description: `${text} panoya kopyalandı.` });
                  }}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold border border-indigo-500/30 transition flex items-center space-x-1"
                >
                  <Copy size={12} />
                  <span>Kopyala</span>
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-2">
                  Kullanıcı Ara & Arkadaş Ekle
                </label>
                <div className="relative">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="kullanıcı adı veya isim girin..."
                    autoFocus
                    className="w-full bg-[#141418] border border-white/10 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-4 py-2.5 pl-10 text-xs text-white placeholder-gray-500 focus:outline-none transition font-mono"
                  />
                  {isSearching && (
                    <Loader2 size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-indigo-400 animate-spin" />
                  )}
                </div>
                <p className="text-[11px] text-gray-400 mt-2">
                  Örn: <span className="text-indigo-300 font-mono">ahmet</span> veya <span className="text-indigo-300 font-mono">ahmet@domain.com</span>
                </p>
              </div>

              {/* Search Results */}
              <div className="space-y-2 pt-1">
                {searchResults.length > 0 ? (
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block px-1">
                      Arama Sonuçları ({searchResults.length})
                    </span>
                    {searchResults.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-indigo-500/30 transition"
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <UserAvatar user={user} size="md" showStatus={true} status={user.status} />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">{user.name}</div>
                            <div className="text-[11px] text-indigo-300/80 font-mono truncate">
                              @{user.username}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={isSending}
                          onClick={() => handleSendRequest(user.id, user.name)}
                          className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/20 transition flex-shrink-0 disabled:opacity-50"
                        >
                          <Send size={12} />
                          <span>İstek Gönder</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : searchQuery.length >= 2 && !isSearching ? (
                  <div className="py-8 text-center text-xs text-gray-400 bg-white/[0.02] rounded-2xl border border-white/5">
                    "{searchQuery}" ile eşleşen kullanıcı bulunamadı.
                  </div>
                ) : (
                  <div className="py-10 text-center text-xs text-gray-400 bg-white/[0.02] rounded-2xl border border-white/5 space-y-2">
                    <UserPlus size={24} className="mx-auto text-indigo-400/60 mb-2" />
                    <div className="text-gray-300 font-medium">Aramak istediğiniz kullanıcının adını veya e-postasını yazın.</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Incoming Requests */}
          {activeTab === 'incoming' && (
            <div className="space-y-2">
              {incomingRequests.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-400 bg-white/[0.02] rounded-2xl border border-white/5 space-y-1.5">
                  <Inbox size={26} className="mx-auto text-indigo-400/60 mb-2" />
                  <div className="font-semibold text-gray-300">Bekleyen Gelen İstek Yok</div>
                  <div className="text-[11px] text-gray-500">Biri size arkadaşlık isteği gönderdiğinde burada listelenir.</div>
                </div>
              ) : (
                incomingRequests.map((req) => (
                  <div
                    key={req.friendshipId}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <UserAvatar user={req} size="md" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{req.name}</div>
                        <div className="text-[11px] text-gray-400">@{req.username} size arkadaşlık isteği gönderdi</div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <button
                        type="button"
                        disabled={actionLoadingId === req.friendshipId}
                        onClick={() => handleAccept(req.friendshipId, req.name)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold transition"
                      >
                        <Check size={12} />
                        <span>Kabul Et</span>
                      </button>
                      <button
                        type="button"
                        disabled={actionLoadingId === req.friendshipId}
                        onClick={() => handleReject(req.friendshipId)}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-xs font-medium border border-white/5 transition"
                      >
                        Reddet
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: Outgoing Requests */}
          {activeTab === 'outgoing' && (
            <div className="space-y-2">
              {outgoingRequests.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-400 bg-white/[0.02] rounded-2xl border border-white/5 space-y-1.5">
                  <Clock size={26} className="mx-auto text-indigo-400/60 mb-2" />
                  <div className="font-semibold text-gray-300">Gönderilmiş Bekleyen İstek Yok</div>
                  <div className="text-[11px] text-gray-500">Gönderdiğiniz bekleyen istekler burada görüntülenir.</div>
                </div>
              ) : (
                outgoingRequests.map((req) => (
                  <div
                    key={req.friendshipId}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <UserAvatar user={req} size="md" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{req.name}</div>
                        <div className="text-[11px] text-gray-400">@{req.username} • İstek beklemede</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={actionLoadingId === req.friendshipId}
                      onClick={() => handleReject(req.friendshipId)}
                      className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl text-xs font-medium border border-red-500/20 transition"
                    >
                      İptal Et
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
          {/* Bottom Close Button */}
          <div className="pt-4 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white rounded-xl text-xs font-semibold border border-indigo-500/30 transition shadow-sm"
            >
              Tamam
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
