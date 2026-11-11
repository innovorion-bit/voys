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
  Copy,
  AlertCircle,
  UserCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { UserAvatar } from './UserAvatar';
import { dbService } from '../lib/supabase';

export const AddFriendModal = ({ 
  isOpen, 
  onClose, 
  currentUser,
  onFriendshipUpdated,
  friends = [],
  incomingRequests = [],
  outgoingRequests = []
}) => {
  const [activeTab, setActiveTab] = useState('search'); // 'search' | 'incoming' | 'outgoing'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    setFeedback(null);
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

  // ESC key listener & sync latest friendships when modal opens
  useEffect(() => {
    if (!isOpen) return;
    onFriendshipUpdated?.();
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setFeedback(null);
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onFriendshipUpdated]);

  const handleCloseModal = () => {
    setFeedback(null);
    onClose();
  };

  if (!isOpen) return null;

  const resolvedCurrentUserId =
    currentUser?.id && currentUser.id !== 'you' ? currentUser.id : null;

  const handleSendRequest = async (targetUserId, targetName) => {
    setFeedback(null);
    if (!resolvedCurrentUserId) {
      const msg = 'Kullanıcı oturumu doğrulanamadı. Lütfen sayfayı yenileyin.';
      setFeedback({ type: 'error', message: msg });
      toast.error('İstek Gönderilemedi', { description: msg });
      return;
    }

    try {
      setIsSending(true);
      await dbService.sendFriendRequest(resolvedCurrentUserId, targetUserId);
      const successMsg = `${targetName || 'Kullanıcı'} kullanıcısına arkadaşlık isteği gönderildi.`;
      setFeedback({ type: 'success', message: successMsg });
      toast.success('Arkadaşlık İsteği Gönderildi', {
        description: `${targetName || 'Kullanıcı'} kullanıcısına istek iletildi.`,
      });
      setSearchQuery('');
      setSearchResults([]);
      onFriendshipUpdated?.();
      setActiveTab('outgoing');
    } catch (err) {
      const msg = err?.message || 'Bir hata oluştu.';
      setFeedback({ type: 'error', message: msg });
      toast.error('İstek Gönderilemedi', {
        description: msg,
      });
      if (
        err?.code === 'ALREADY_FRIENDS' ||
        err?.code === 'PENDING_INCOMING' ||
        err?.code === 'PENDING_OUTGOING' ||
        /zaten|mevcut|bekleyen/i.test(msg)
      ) {
        onFriendshipUpdated?.();
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleAccept = async (friendshipId, friendName) => {
    setFeedback(null);
    try {
      setActionLoadingId(friendshipId);
      await dbService.acceptFriendRequest(friendshipId);
      const msg = `${friendName || 'Kullanıcı'} artık arkadaş listenizde!`;
      setFeedback({ type: 'success', message: msg });
      toast.success('Arkadaşlık İsteği Kabul Edildi', {
        description: msg,
      });
      onFriendshipUpdated?.();
    } catch (err) {
      const msg = err?.message || 'İstek kabul edilirken hata oluştu.';
      setFeedback({ type: 'error', message: msg });
      toast.error('Hata Oluştu', { description: msg });
      onFriendshipUpdated?.();
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (friendshipId) => {
    setFeedback(null);
    try {
      setActionLoadingId(friendshipId);
      await dbService.rejectFriendRequest(friendshipId);
      setFeedback({ type: 'info', message: 'İstek kaldırıldı.' });
      toast.info('İstek Kaldırıldı');
      onFriendshipUpdated?.();
    } catch (err) {
      const msg = err?.message || 'İstek kaldırılırken hata oluştu.';
      setFeedback({ type: 'error', message: msg });
      toast.error('Hata Oluştu', { description: msg });
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
          onClick={handleCloseModal}
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
          {feedback && (
            <div
              role="alert"
              className={`p-3 rounded-2xl border text-xs flex items-center justify-between space-x-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                  : feedback.type === 'info'
                    ? 'bg-indigo-500/10 border-indigo-500/25 text-indigo-300'
                    : 'bg-rose-500/10 border-rose-500/25 text-rose-300'
              }`}
            >
              <div className="flex items-center space-x-2 min-w-0">
                <AlertCircle size={15} className="flex-shrink-0" />
                <span>{feedback.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="text-current/70 hover:text-white transition flex-shrink-0"
                aria-label="Bildirimi kapat"
              >
                <X size={14} />
              </button>
            </div>
          )}

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
                    {searchResults.map((user) => {
                      const isAlreadyFriend = friends.some((f) => f.id === user.id);
                      const incomingReq = incomingRequests.find((i) => i.id === user.id);
                      const isPendingOutgoing = outgoingRequests.some((o) => o.id === user.id);
                      const isAcceptingThis = incomingReq && actionLoadingId === incomingReq.friendshipId;

                      return (
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

                          {isAlreadyFriend ? (
                            <span className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-semibold flex-shrink-0">
                              <UserCheck size={13} />
                              <span>Arkadaş</span>
                            </span>
                          ) : incomingReq ? (
                            <button
                              type="button"
                              disabled={isAcceptingThis}
                              onClick={() => handleAccept(incomingReq.friendshipId, user.name)}
                              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20 transition flex-shrink-0 disabled:opacity-50"
                            >
                              {isAcceptingThis ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                              <span>Kabul Et</span>
                            </button>
                          ) : isPendingOutgoing ? (
                            <span className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-xl text-xs font-medium flex-shrink-0">
                              <Clock size={12} />
                              <span>İletildi</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={isSending}
                              onClick={() => handleSendRequest(user.id, user.name)}
                              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/20 transition flex-shrink-0 disabled:opacity-50"
                            >
                              {isSending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                              <span>İstek Gönder</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
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
