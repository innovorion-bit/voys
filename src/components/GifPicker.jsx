import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Loader2, Sparkles } from 'lucide-react';

// Sleek GIF SVG icon matching Lucide aesthetic
export const GifIcon = ({ size = 16, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="2" y="4" width="20" height="16" rx="4" />
    <path d="M8 9H6.5A1.5 1.5 0 0 0 5 10.5v3A1.5 1.5 0 0 0 6.5 15H8v-2.5H7" />
    <path d="M12 9v6" />
    <path d="M16 15v-6h3" />
    <path d="M16 12h2" />
  </svg>
);

// High-capacity GIPHY API keys with automatic fallback
const GIPHY_KEYS = [
  'Gc7131jiJuvI7IdN0HZ1D7nh0ow5BU6g',
  'MRwXFtxAnaHo3EUMrSefHWmI0eYz5aGe',
  'L8eXbxrbPETZxlvgXN9kIEzQ55Df04v0',
  '3eFQvabDx69SMoOemSPiYfh9FY0nzO9x',
  'tUvmR6B6lDILWeKDw21eomF3R6hts3UP',
];

let activeKeyIndex = 0;

// Reliable fallback GIFs if offline or API blocked
const FALLBACK_GIFS = [
  {
    id: 'fb-1',
    title: 'Laughing Doge',
    preview: 'https://i.giphy.com/media/10JhviFuU2gWD6/giphy.gif',
    original: 'https://i.giphy.com/media/10JhviFuU2gWD6/giphy.gif',
  },
  {
    id: 'fb-2',
    title: 'Clapping',
    preview: 'https://i.giphy.com/media/nbvFVPiEiJH6JOGIok/giphy.gif',
    original: 'https://i.giphy.com/media/nbvFVPiEiJH6JOGIok/giphy.gif',
  },
  {
    id: 'fb-3',
    title: 'Popcorn Time',
    preview: 'https://i.giphy.com/media/pUeXcg80cO8I8/giphy.gif',
    original: 'https://i.giphy.com/media/pUeXcg80cO8I8/giphy.gif',
  },
  {
    id: 'fb-4',
    title: 'Carlton Dance',
    preview: 'https://i.giphy.com/media/pa37AAGzKXoek/giphy.gif',
    original: 'https://i.giphy.com/media/pa37AAGzKXoek/giphy.gif',
  },
  {
    id: 'fb-5',
    title: 'Thumbs Up',
    preview: 'https://i.giphy.com/media/111ebonMs90YLu/giphy.gif',
    original: 'https://i.giphy.com/media/111ebonMs90YLu/giphy.gif',
  },
  {
    id: 'fb-6',
    title: 'High Five',
    preview: 'https://i.giphy.com/media/774uK11mxE3W0cjE8L/giphy.gif',
    original: 'https://i.giphy.com/media/774uK11mxE3W0cjE8L/giphy.gif',
  },
  {
    id: 'fb-7',
    title: 'Facepalm',
    preview: 'https://i.giphy.com/media/3oEjI67Egb8G9jqs3m/giphy.gif',
    original: 'https://i.giphy.com/media/3oEjI67Egb8G9jqs3m/giphy.gif',
  },
];

const CATEGORIES = [
  { label: 'Trend', query: '' },
  { label: 'Komik', query: 'funny' },
  { label: 'Alkış', query: 'applause' },
  { label: 'Dans', query: 'dance' },
  { label: 'Kedi', query: 'cat' },
  { label: 'Oyun', query: 'gaming' },
  { label: 'Sevgi', query: 'love' },
  { label: 'Parti', query: 'party' },
  { label: 'Şaşkın', query: 'shocked' },
  { label: 'Havalı', query: 'cool' },
  { label: 'Selam', query: 'hello' },
  { label: 'Kahve', query: 'coffee' },
];

export default function GifPicker({ onSelectGif, onClose }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Focus input automatically on open
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Fetch GIFs from GIPHY
  const loadGifs = useCallback(async (query = '') => {
    setLoading(true);
    setError(null);

    const isSearch = Boolean(query && query.trim());
    const endpoint = isSearch ? 'search' : 'trending';

    for (let attempt = 0; attempt < GIPHY_KEYS.length; attempt++) {
      const key = GIPHY_KEYS[(activeKeyIndex + attempt) % GIPHY_KEYS.length];
      const params = new URLSearchParams({
        api_key: key,
        limit: '32',
        rating: 'g',
      });
      if (isSearch) {
        params.set('q', query.trim());
      }

      try {
        const response = await fetch(`https://api.giphy.com/v1/gifs/${endpoint}?${params.toString()}`);
        if (response.ok) {
          activeKeyIndex = (activeKeyIndex + attempt) % GIPHY_KEYS.length;
          const json = await response.json();
          const items = (json.data || []).map((item) => ({
            id: item.id,
            title: item.title || 'GIF',
            preview:
              item.images?.fixed_width?.url ||
              item.images?.fixed_width_small?.url ||
              item.images?.downsized?.url ||
              `https://i.giphy.com/media/${item.id}/giphy.gif`,
            original:
              item.images?.original?.url ||
              item.images?.downsized_large?.url ||
              item.images?.downsized?.url ||
              `https://i.giphy.com/media/${item.id}/giphy.gif`,
            width: item.images?.fixed_width?.width,
            height: item.images?.fixed_width?.height,
          }));

          setGifs(items);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn('Giphy request failed for key, trying next key...', err);
      }
    }

    // Fallback if all keys or network failed
    setGifs(FALLBACK_GIFS);
    setLoading(false);
  }, []);

  // Initial load: trending GIFs
  useEffect(() => {
    loadGifs('');
  }, [loadGifs]);

  // Handle Search Input Change with Debounce
  const handleInputChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    setSelectedCategory('');

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      loadGifs(val);
    }, 350);
  };

  // Clear search input
  const handleClearSearch = () => {
    setSearchQuery('');
    setSelectedCategory('');
    loadGifs('');
    inputRef.current?.focus();
  };

  // Select category
  const handleSelectCategory = (cat) => {
    setSelectedCategory(cat.query);
    setSearchQuery('');
    loadGifs(cat.query);
  };

  // Split into 2 columns for a masonry-like grid
  const col1 = gifs.filter((_, idx) => idx % 2 === 0);
  const col2 = gifs.filter((_, idx) => idx % 2 === 1);

  return (
    <div className="gif-picker-container absolute bottom-12 right-[-32px] shadow-2xl rounded-2xl overflow-hidden border border-white/10 bg-[#121216] z-50 w-[295px] h-[350px] flex flex-col select-none isolate animate-in fade-in zoom-in-95 duration-150">
      {/* Header with Search and Close */}
      <div className="p-2.5 pb-2 border-b border-white/5 flex items-center gap-2 bg-[#121216] rounded-t-2xl">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={handleInputChange}
            placeholder="GIF ara..."
            className="w-full pl-7 pr-6 py-1 bg-white/5 hover:bg-white/[0.08] focus:bg-white/10 text-white placeholder-gray-400 text-xs rounded-lg border border-white/10 focus:border-indigo-500/60 focus:outline-none transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition"
            title="Kapat"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Category Pills */}
      <div className="px-2.5 py-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-white/5 bg-[#0e0e12]">
        {CATEGORIES.map((cat) => {
          const isActive =
            selectedCategory === cat.query && (cat.query !== '' || searchQuery === '');
          return (
            <button
              key={cat.label}
              type="button"
              onClick={() => handleSelectCategory(cat)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-medium whitespace-nowrap transition flex-shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white/5 text-gray-300 hover:text-white hover:bg-white/10'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar min-h-0 bg-[#0d0d11] rounded-b-2xl">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs py-10">
            <Loader2 size={20} className="animate-spin text-indigo-400 mb-2" />
            <span className="text-[11px]">GIF'ler yükleniyor...</span>
          </div>
        ) : gifs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs py-10">
            <Sparkles size={20} className="text-gray-500 mb-2" />
            <span className="text-[11px]">GIF bulunamadı.</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            <div className="flex flex-col gap-1.5">
              {col1.map((gif) => (
                <button
                  key={gif.id}
                  type="button"
                  onClick={() => onSelectGif?.(gif)}
                  className="group relative rounded-lg overflow-hidden bg-black/40 border border-white/5 hover:border-indigo-500/70 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer text-left focus:outline-none"
                  title={gif.title}
                >
                  <img
                    src={gif.preview}
                    alt={gif.title}
                    loading="lazy"
                    className="w-full h-auto object-cover rounded-lg block"
                  />
                  {/* Subtle dark gradient overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-1.5 flex items-end">
                    <span className="text-[9px] text-white font-medium truncate drop-shadow">
                      {gif.title || 'GIF'}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-1.5">
              {col2.map((gif) => (
                <button
                  key={gif.id}
                  type="button"
                  onClick={() => onSelectGif?.(gif)}
                  className="group relative rounded-lg overflow-hidden bg-black/40 border border-white/5 hover:border-indigo-500/70 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer text-left focus:outline-none"
                  title={gif.title}
                >
                  <img
                    src={gif.preview}
                    alt={gif.title}
                    loading="lazy"
                    className="w-full h-auto object-cover rounded-lg block"
                  />
                  {/* Subtle dark gradient overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-1.5 flex items-end">
                    <span className="text-[9px] text-white font-medium truncate drop-shadow">
                      {gif.title || 'GIF'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
