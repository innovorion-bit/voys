import React, { useState } from 'react';
import { 
  X, 
  UserPlus, 
  Check, 
  Search, 
  Hash, 
  Users, 
  Radio, 
  Loader2 
} from 'lucide-react';
import { toast } from 'sonner';
import { UserAvatar } from './UserAvatar';
import { dbService } from '../lib/supabase';

export const AddMemberModal = ({ 
  isOpen, 
  onClose, 
  activeChannel, 
  channelName = 'Sohbet',
  channelType = 'text',
  friends = [],
  currentMembers = [],
  onMemberAdded
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [addingId, setAddingId] = useState(null);

  if (!isOpen) return null;

  // Set of user IDs already members
  const memberIdSet = new Set(
    currentMembers.map((m) => (typeof m === 'string' ? m : m.user_id || m.id))
  );

  const filteredFriends = friends.filter((f) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (f.name && f.name.toLowerCase().includes(q)) ||
      (f.username && f.username.toLowerCase().includes(q))
    );
  });

  const handleAddMember = async (friend) => {
    try {
      setAddingId(friend.id);
      await dbService.addChannelMember(activeChannel, friend.id, 'member');
      toast.success('Üye Sohbete Eklendi', {
        description: `${friend.name || 'Arkadaşınız'} bu sohbete katıldı.`,
      });
      onMemberAdded?.(friend);
    } catch (err) {
      toast.error('Üye Eklenemedi', {
        description: err.message || 'Bir problem oluştu.',
      });
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-[#0c0c0e]/95 backdrop-blur-2xl border border-white/10 w-full max-w-md rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8),0_0_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden text-gray-200 select-none max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white/[0.02] border-b border-white/10">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0 shadow-inner">
              {channelType === 'voice' ? <Radio size={18} /> : <Hash size={18} />}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white tracking-wide truncate">
                {channelName} Kanalına Üye Ekle
              </h2>
              <p className="text-[11px] text-gray-400">Arkadaşlarınızı bu sohbet odasına davet edin</p>
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

        {/* Filter Search Input */}
        <div className="px-6 py-3 border-b border-white/5 bg-white/[0.01]">
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Arkadaşlarınız arasında arayın..."
              className="w-full bg-[#141418] border border-white/10 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-4 py-2 pl-9 text-xs text-white placeholder-gray-500 focus:outline-none transition"
              autoFocus
            />
          </div>
        </div>

        {/* Friends List */}
        <div className="p-6 overflow-y-auto flex-1 max-h-[340px] space-y-2">
          {friends.length === 0 ? (
            <div className="py-10 text-center text-xs text-gray-400 bg-white/[0.02] rounded-2xl border border-white/5 space-y-2">
              <Users size={26} className="mx-auto text-indigo-400/60 mb-2" />
              <div className="font-semibold text-gray-300">Henüz Arkadaşınız Yok</div>
              <div className="text-[11px] text-gray-500">Sohbete eklemek için önce arkadaş eklemelisiniz.</div>
            </div>
          ) : filteredFriends.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400 bg-white/[0.02] rounded-2xl border border-white/5">
              Aramanızla eşleşen arkadaş bulunamadı.
            </div>
          ) : (
            filteredFriends.map((friend) => {
              const isAlreadyMember = memberIdSet.has(friend.id);
              const isAdding = addingId === friend.id;

              return (
                <div
                  key={friend.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-indigo-500/30 transition"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <UserAvatar 
                      user={friend} 
                      size="md" 
                      showStatus={true} 
                      status={friend.status} 
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate flex items-center space-x-1">
                        <span>{friend.name}</span>
                        {friend.hasCrown && <span className="text-amber-400 text-[10px]">👑</span>}
                      </div>
                      <div className="text-[11px] text-gray-400 truncate">
                        {friend.game ? (
                          <span className="text-indigo-300">{friend.game}</span>
                        ) : friend.isOnline ? (
                          <span className="text-indigo-400">{friend.substatus || 'Çevrimiçi'}</span>
                        ) : (
                          <span>Çevrimdışı</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Add button / already added label */}
                  {isAlreadyMember ? (
                    <span className="flex items-center space-x-1 px-3 py-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 rounded-xl">
                      <Check size={12} />
                      <span>Üye</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={isAdding}
                      onClick={() => handleAddMember(friend)}
                      className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/20 transition disabled:opacity-50"
                    >
                      {isAdding ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <UserPlus size={12} />
                      )}
                      <span>Ekle</span>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white/[0.02] border-t border-white/10 flex items-center justify-between">
          <span className="text-[11px] text-gray-500">
            {currentMembers.length} mevcut üye
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-xs font-semibold border border-white/10 transition"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
};
