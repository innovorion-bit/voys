import React from 'react';

export const LogoutConfirmModal = ({
  isOpen = false,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 select-none"
      onClick={onClose}
    >
      <div 
        className="bg-[#121216] border border-white/10 rounded-2xl w-full max-w-xs p-5 shadow-xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-medium text-white text-center">
          Çıkmak istediğinize emin misiniz?
        </p>

        <div className="flex items-center space-x-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 text-xs font-medium text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition cursor-pointer border border-white/5"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition cursor-pointer"
          >
            Çıkış Yap
          </button>
        </div>
      </div>
    </div>
  );
};
