import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { X, ZoomIn, ZoomOut, RotateCw, Check, Loader2 } from 'lucide-react';
import { getCroppedImg } from '../utils/cropImage';

export const ImageCropModal = ({
  isOpen,
  imageSrc,
  onClose,
  onApply,
  title = 'Fotoğrafı Kırp ve Ayarla',
  subtitle = 'Daire içindeki alan profil resminiz olarak görünecektir.',
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCropComplete = useCallback((_croppedArea, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels || isSubmitting) return;
    try {
      setIsSubmitting(true);
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels, rotation, 512);
      await onApply(croppedBlob);
      onClose();
    } catch (err) {
      console.warn('Fotoğraf kırpma hatası:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !imageSrc) return null;

  return (
    <div
      onClick={onClose}
      className="fixed top-8 inset-x-0 bottom-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0e0e12] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <h3 className="text-sm font-bold text-white truncate">{title}</h3>
            {subtitle && (
              <p className="text-[11px] text-gray-400 truncate mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition border border-white/5 cursor-pointer disabled:opacity-50 flex-shrink-0"
            title="Kapat"
          >
            <X size={14} />
          </button>
        </div>

        {/* Cropper Viewport */}
        <div className="relative w-full h-72 sm:h-80 bg-[#070709] overflow-hidden">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
            classes={{
              containerClassName: 'relative w-full h-full',
              mediaClassName: 'max-w-none',
              cropAreaClassName: '!border-2 !border-[#8B51FF] !shadow-[0_0_0_9999px_rgba(0,0,0,0.7)]',
            }}
          />
        </div>

        {/* Controls: Zoom & Rotate */}
        <div className="p-4 border-t border-white/[0.08] space-y-3 bg-[#111215]">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              disabled={isSubmitting || zoom <= 1}
              onClick={() => setZoom((z) => Math.max(1, +(z - 0.2).toFixed(2)))}
              className="text-gray-400 hover:text-white disabled:opacity-30 transition cursor-pointer"
              title="Uzaklaştır"
            >
              <ZoomOut size={16} />
            </button>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              disabled={isSubmitting}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-[#8B51FF] h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
            />
            <button
              type="button"
              disabled={isSubmitting || zoom >= 3}
              onClick={() => setZoom((z) => Math.min(3, +(z + 0.2).toFixed(2)))}
              className="text-gray-400 hover:text-white disabled:opacity-30 transition cursor-pointer"
              title="Yakınlaştır"
            >
              <ZoomIn size={16} />
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleRotate}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition cursor-pointer"
              title="90° Döndür"
            >
              <RotateCw size={14} />
            </button>
            <span className="text-[11px] text-gray-400 font-mono w-10 text-right">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-2.5 pt-1">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-xs font-medium border border-white/10 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              İptal
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSave}
              className="inline-flex items-center space-x-1.5 px-5 py-2 bg-[#8B51FF] hover:bg-[#773BF5] text-white rounded-xl text-xs font-semibold shadow-md transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Kaydediliyor...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Uygula ve Kaydet</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
