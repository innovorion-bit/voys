import React from 'react';
import { Phone, PhoneOff, PhoneCall } from 'lucide-react';
import { UserAvatar } from './UserAvatar';

export const IncomingCallToast = ({
  call,
  ringCount = 1,
  maxRings = 3,
  onAccept,
  onDecline,
}) => {
  if (!call || !call.initiator) return null;

  const initiator = call.initiator;
  const callerName = initiator.name || initiator.display_name || initiator.username || 'Kullanıcı';

  return (
    <div className="fixed top-5 right-5 z-[999] max-w-sm w-full pointer-events-auto">
      <div className="p-4 rounded-3xl bg-[#0c0c10] border-2 border-emerald-500/40 shadow-2xl flex flex-col space-y-3.5">
        <div className="flex items-center space-x-3.5">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="relative">
              <UserAvatar user={initiator} size="lg" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-600 border-2 border-[#0c0c10] flex items-center justify-center text-white">
              <PhoneCall size={10} />
            </div>
          </div>

          {/* Caller Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Gelen Sesli Arama
              </span>
              <span className="text-[11px] font-mono text-gray-400 flex items-center space-x-1">
                <span>Çalıyor</span>
                <span className="text-emerald-400 font-bold font-mono">({ringCount}/{maxRings})</span>
              </span>
            </div>
            <h4 className="text-sm font-extrabold text-white truncate mt-0.5">
              {callerName}
            </h4>
            <p className="text-[11px] text-gray-400 truncate">
              Sesli sohbete çağırıyor...
            </p>
          </div>
        </div>

        {/* 3 Rings Progress Dots */}
        <div className="flex items-center justify-center space-x-2 py-0.5">
          {[1, 2, 3].map((r) => (
            <div
              key={r}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                ringCount >= r 
                  ? 'w-7 bg-emerald-400' 
                  : 'w-2 bg-white/10'
              }`}
            />
          ))}
        </div>

        {/* Action Buttons: Kabul Et & Reddet */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={onDecline}
            className="flex items-center justify-center space-x-2 py-2.5 px-3 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-white font-semibold text-xs transition active:scale-95 shadow-sm"
          >
            <PhoneOff size={14} />
            <span>Reddet</span>
          </button>

          <button
            type="button"
            onClick={onAccept}
            className="flex items-center justify-center space-x-2 py-2.5 px-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs transition active:scale-95"
          >
            <Phone size={14} />
            <span>Kabul Et</span>
          </button>
        </div>
      </div>
    </div>
  );
};
