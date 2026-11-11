import React from 'react';
import { 
  MessageSquare, 
  Users, 
  Hash, 
  Plus, 
  Settings2,
  Radio,
  LogOut
} from 'lucide-react';
import { UserAvatar } from './UserAvatar';

export const NavigationRail = ({
  activeTab = 'channels', // 'channels' | 'dms' | 'friends' | 'explore'
  onSelectTab,
  incomingRequestsCount = 0,
  unreadMessagesCount = 3,
  onOpenCreateChannel,
  onOpenSettings,
  onLogout,
  currentUserProfile,
}) => {
  return (
    <nav className="w-[70px] flex-shrink-0 h-full bg-[#08080a] border-r border-white/5 flex flex-col items-center justify-between py-3 select-none z-20">
      {/* Top Icons */}
      <div className="flex flex-col items-center space-y-3 w-full">
        {/* Brand Logo / Main App Button */}
        <div className="relative group flex items-center justify-center w-full">
          {/* Active indicator bar */}
          <div className="absolute left-0 w-1 h-9 bg-indigo-500 rounded-r-full" />
          
          <button
            type="button"
            onClick={() => onSelectTab?.('channels')}
            className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#8B51FF]/30 to-[#121216] border border-indigo-500/40 hover:border-indigo-400 flex items-center justify-center text-indigo-400 hover:text-white shadow-[0_0_20px_rgba(139,81,255,0.25)] transition-all transform hover:scale-105 active:scale-95 group"
            title="Voys Ana Ekran"
          >
            <Radio size={24} className="text-[#a36eff] group-hover:text-white transition-colors" />
          </button>
        </div>

        {/* Separator */}
        <div className="w-8 h-[1px] bg-white/10 my-1" />

        {/* Direct Messages (Chat bubble) */}
        <div className="relative group flex items-center justify-center w-full">
          {activeTab === 'dms' && (
            <div className="absolute left-0 w-1 h-6 bg-white rounded-r-full" />
          )}
          <button
            type="button"
            onClick={() => onSelectTab?.('dms')}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all relative ${
              activeTab === 'dms'
                ? 'bg-[#18181f] text-white shadow-lg border border-indigo-500/30'
                : 'text-gray-400 hover:text-gray-100 hover:bg-[#141418]'
            }`}
            title="Direkt Mesajlar (DM)"
          >
            <MessageSquare size={19} />
            {unreadMessagesCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 bg-[#ef4444] text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md">
                {unreadMessagesCount}
              </span>
            )}
          </button>
        </div>

        {/* Friends / Community */}
        <div className="relative group flex items-center justify-center w-full">
          {activeTab === 'friends' && (
            <div className="absolute left-0 w-1 h-6 bg-white rounded-r-full" />
          )}
          <button
            type="button"
            onClick={() => onSelectTab?.('friends')}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all relative ${
              activeTab === 'friends'
                ? 'bg-[#18181f] text-white shadow-lg border border-indigo-500/30'
                : 'text-gray-400 hover:text-gray-100 hover:bg-[#141418]'
            }`}
            title="Arkadaşlar"
          >
            <Users size={19} />
            {incomingRequestsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 bg-[#ef4444] text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md">
                {incomingRequestsCount}
              </span>
            )}
          </button>
        </div>

        {/* Channels / Server Hub */}
        <div className="relative group flex items-center justify-center w-full">
          {activeTab === 'channels' && (
            <div className="absolute left-0 w-1 h-6 bg-white rounded-r-full" />
          )}
          <button
            type="button"
            onClick={() => onSelectTab?.('channels')}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all relative ${
              activeTab === 'channels'
                ? 'bg-[#18181f] text-white shadow-lg border border-indigo-500/40 ring-1 ring-indigo-500/30'
                : 'text-gray-400 hover:text-gray-100 hover:bg-[#141418]'
            }`}
            title="Sunucu Kanalları"
          >
            <Hash size={20} />
          </button>
        </div>

        {/* Add Channel / Community Button */}
        <button
          type="button"
          onClick={onOpenCreateChannel}
          className="w-11 h-11 rounded-xl border border-dashed border-gray-600 hover:border-indigo-400 text-gray-400 hover:text-indigo-300 hover:bg-indigo-500/10 flex items-center justify-center transition-all group"
          title="Yeni Sohbet veya Kanal Oluştur"
        >
          <Plus size={20} className="group-hover:scale-110 transition-transform" />
        </button>
      </div>

      {/* Bottom User Area & Settings */}
      <div className="flex flex-col items-center space-y-3 w-full pb-1">
        {/* Settings Button */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#141418] transition-all"
          title="Ayarlar"
        >
          <Settings2 size={19} />
        </button>

        {/* Current User Avatar with Live Status */}
        <div className="relative group cursor-pointer" onClick={onOpenSettings} title={currentUserProfile?.name || 'Profilim'}>
          <UserAvatar
            user={currentUserProfile}
            size="md"
            showStatus={true}
            status={currentUserProfile?.status || 'online'}
          />
        </div>

        {/* Logout Button */}
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
            title="Oturumu Kapat (Çıkış Yap)"
          >
            <LogOut size={18} />
          </button>
        )}
      </div>
    </nav>
  );
};
