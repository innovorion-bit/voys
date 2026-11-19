import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Download,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/useAuth';

export const LandingPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const directExeUrl = '/Voys_1.0.0_x64-setup.exe';

  const handleDownloadClick = (url) => {
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 5000);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="w-full min-h-[3240px] text-gray-200 selection:bg-[#8B51FF]/40 selection:text-white font-sans antialiased overflow-x-hidden relative flex flex-col justify-between bg-[#07050f] scroll-smooth"
      style={{
        backgroundImage: "url('/voys_hero_bg.jpg?v=3')",
        backgroundSize: '1920px 3240px',
        backgroundPosition: 'top center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* 1. Header / Navbar - Arka plana yapışık (relative) */}
      <header className="relative z-50 bg-transparent pt-4 sm:pt-6 pb-2">
        <div className="w-full px-6 sm:px-10 lg:px-16 h-14 sm:h-16 flex items-center justify-between relative">
          {/* Logo & Brand (Far Left) */}
          <Link to="/" className="flex items-center group shrink-0 z-10" title="Voys">
            <img
              src="/voys_weblogo.png"
              alt="Voys"
              className="h-7 sm:h-8 w-auto object-contain transition-transform duration-200 group-hover:scale-105"
            />
          </Link>

          {/* Nav Links - Sade, Zarif ve Akıcı Floating Capsule Menu */}
          <nav className="hidden md:flex items-center px-1.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-md shadow-lg shadow-black/20 absolute left-1/2 -translate-x-1/2 whitespace-nowrap">
            <a
              href="#discover"
              className="px-4 py-1.5 rounded-full text-xs lg:text-sm font-medium text-gray-300 hover:text-white hover:bg-white/[0.08] transition-all duration-200"
            >
              Keşfedin
            </a>
            <a
              href="#security"
              className="px-4 py-1.5 rounded-full text-xs lg:text-sm font-medium text-gray-300 hover:text-white hover:bg-white/[0.08] transition-all duration-200"
            >
              Güvenlik
            </a>
            <a
              href="#performance"
              className="px-4 py-1.5 rounded-full text-xs lg:text-sm font-medium text-gray-300 hover:text-white hover:bg-white/[0.08] transition-all duration-200"
            >
              Performans
            </a>
            <a
              href="#support"
              className="px-4 py-1.5 rounded-full text-xs lg:text-sm font-medium text-gray-300 hover:text-white hover:bg-white/[0.08] transition-all duration-200"
            >
              Destek
            </a>
            <button
              type="button"
              onClick={() => handleDownloadClick(directExeUrl)}
              className="px-4 py-1.5 rounded-full text-xs lg:text-sm font-medium text-gray-300 hover:text-white hover:bg-white/[0.08] transition-all duration-200 cursor-pointer"
            >
              İndir
            </button>
          </nav>

          {/* Action Buttons - Beyaz Buton Siyah Yazı (Far Right) */}
          <div className="flex items-center shrink-0 z-10">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => navigate('/channel/home')}
                className="text-xs sm:text-sm font-medium px-5 py-2 rounded-full bg-white hover:bg-gray-100 text-gray-950 shadow-sm hover:shadow transition-all duration-200 flex items-center space-x-1.5 cursor-pointer active:scale-95"
              >
                <span>Uygulamaya Git</span>
                <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-xs sm:text-sm font-medium px-5 py-2 rounded-full bg-white hover:bg-gray-100 text-gray-950 shadow-sm hover:shadow transition-all duration-200 cursor-pointer active:scale-95"
              >
                Giriş Yap
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Download Alert Toast */}
      {downloadSuccess && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#121217] border border-[#8B51FF]/50 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center space-x-3 animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 size={20} className="text-[#a36eff] flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold">Voys İndiriliyor!</p>
            <p className="text-xs text-gray-400">İndirme tamamlandığında kurulumu çalıştırıp hemen bağlanabilirsiniz.</p>
          </div>
        </div>
      )}

      {/* 2. Hero Section (Centered headline, subtitle and buttons) */}
      <section className="relative z-10 flex flex-col items-center justify-center pt-20 sm:pt-28 pb-28 sm:pb-36 px-6 sm:px-10 lg:px-16 max-w-5xl mx-auto text-center">
        {/* Hero Title */}
        <h1 className="max-w-4xl text-4xl sm:text-5xl md:text-6xl lg:text-[68px] font-extrabold tracking-tight text-white mb-6 leading-[1.12] text-center drop-shadow-[0_4px_20px_rgba(0,0,0,0.7)]">
          Birlikte Konuşmak ve Paylaşmak İçin{' '}
          <span className="inline-block bg-gradient-to-r from-[#d8b4fe] via-[#f0abfc] to-[#ffffff] bg-clip-text text-transparent drop-shadow-[0_2px_20px_rgba(192,132,252,0.8)]">
            Yepyeni Bir Boyut.
          </span>
        </h1>

        {/* Hero Subtitle */}
        <p className="max-w-2xl text-base sm:text-lg md:text-xl text-gray-200 font-normal leading-relaxed mb-12 text-center drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
          Düşük gecikmeli ses kanalları, yapay zeka destekli arka plan gürültü filtresi,
          60 FPS ekran paylaşımı ve kesintisiz grup sohbetleri. Arkadaşların ve topluluğun için özel alanın.
        </p>

        {/* Hero CTA Buttons - Sayfaya tam ortalanmış, arka planla uyumlu aşağı kaydırılmış */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5 w-full mt-2 sm:mt-6">
          {/* Main Direct Download CTA - Beyaz Buton Siyah Yazı */}
          <button
            type="button"
            onClick={() => handleDownloadClick(directExeUrl)}
            className="w-full sm:w-[260px] h-[54px] rounded-2xl bg-white hover:bg-gray-100 text-gray-900 font-bold text-sm sm:text-base shadow-xl shadow-black/25 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center space-x-2.5 cursor-pointer group whitespace-nowrap"
          >
            <Download size={19} className="text-gray-900 group-hover:-translate-y-0.5 transition-transform shrink-0" />
            <span>Windows için İndir</span>
          </button>

          {/* Open in Browser CTA - Mor Buton Beyaz Yazı */}
          <button
            type="button"
            onClick={() => navigate(isAuthenticated ? '/channel/home' : '/login')}
            className="w-full sm:w-[260px] h-[54px] rounded-2xl bg-[#8B51FF] hover:bg-[#7a3ef2] border border-white/15 hover:border-white/30 text-white font-bold text-sm sm:text-base shadow-xl shadow-[#8B51FF]/35 hover:shadow-[#8B51FF]/55 transition-all flex items-center justify-center space-x-2.5 cursor-pointer hover:scale-[1.02] active:scale-[0.98] group whitespace-nowrap"
          >
            <span>Voys'u Tarayıcında Aç</span>
            <ArrowRight size={16} className="text-white/80 group-hover:text-white group-hover:translate-x-0.5 transition-transform ml-0.5 shrink-0" />
          </button>
        </div>
      </section>

      {/* 3. Keşfedin (#discover) - App Preview & Highlights */}
      <section id="discover" className="relative z-10 py-24 px-6 sm:px-10 lg:px-16 max-w-6xl mx-auto w-full text-center scroll-mt-20">
        <div className="inline-block px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-[#d8b4fe] text-xs font-semibold uppercase tracking-widest mb-5 backdrop-blur-sm">
          Keşfedin
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
          Modern ve Sade İletişim Deneyimi
        </h2>
        <p className="max-w-2xl mx-auto text-sm sm:text-base text-gray-300 font-normal leading-relaxed mb-12">
          Gereksiz karmaşıklıktan arındırılmış, doğrudan kristal netliğinde ses kalitesine, kesintisiz sohbetlere ve topluluğunuza odaklanan yeni nesil iletişim platformu.
        </p>

        {/* Mock Interface Window Showcase */}
        <div className="relative mx-auto rounded-2xl border border-white/15 bg-[#0e0920]/80 shadow-[0_20px_80px_rgba(139,81,255,0.2)] overflow-hidden backdrop-blur-xl group">
          {/* Top Window Bar */}
          <div className="h-10 px-4 bg-[#140e2e]/90 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-rose-500/80" />
              <div className="w-3 h-3 rounded-full bg-amber-500/80" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
            </div>
            <span className="text-[11px] font-mono text-gray-400">Voys Desktop Client • v1.0.0</span>
            <div className="w-12" />
          </div>

          {/* Vector UI Graphic Illustration of Voys Client */}
          <div className="relative overflow-hidden bg-[#080514]/95 p-2 sm:p-4 text-left select-none">
            {/* Inner App Frame */}
            <div className="w-full rounded-xl border border-white/10 bg-[#0c081c] shadow-2xl overflow-hidden flex flex-col md:grid md:grid-cols-12 min-h-[460px] sm:min-h-[500px]">
              
              {/* 1. Left Channel & Chat Sidebar (col-span-3) */}
              <div className="hidden lg:flex lg:col-span-3 flex-col justify-between bg-[#090616]/95 border-r border-white/[0.08] p-3 text-xs">
                <div>
                  {/* Search Bar Vector */}
                  <div className="flex items-center space-x-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-gray-400 mb-3">
                    <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span className="text-[11px] text-gray-400 truncate">Sohbet veya kanal arayın...</span>
                  </div>

                  {/* Filter Tabs */}
                  <div className="flex items-center space-x-1.5 mb-3">
                    <span className="px-2.5 py-1 rounded-lg bg-[#8B51FF]/20 border border-[#8B51FF]/40 text-[#d8b4fe] font-semibold text-[11px]">
                      Tümü
                    </span>
                    <span className="px-2.5 py-1 rounded-lg text-gray-400 hover:text-white text-[11px]">
                      Kişiler
                    </span>
                    <span className="px-2.5 py-1 rounded-lg text-gray-400 hover:text-white text-[11px]">
                      Gruplar
                    </span>
                  </div>

                  {/* Channel / Chat List */}
                  <div className="space-y-1">
                    {/* Active Selected Channel: Game Fedaileri */}
                    <div className="p-2 rounded-xl bg-[#8B51FF]/15 border border-[#8B51FF]/30 text-white flex items-center space-x-2.5">
                      <div className="relative w-8 h-8 rounded-lg bg-gradient-to-tr from-[#8B51FF] to-[#c084fc] flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-md">
                        GF
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#0c081c]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-white truncate">Game Fedaileri</span>
                          <span className="text-[10px] text-emerald-400 font-mono">18:24</span>
                        </div>
                        <div className="flex items-center space-x-1 text-[11px] text-[#d8b4fe]/80 truncate">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 animate-ping" />
                          <span className="truncate">Sesli Kanal Aktif</span>
                        </div>
                      </div>
                    </div>

                    {/* Channel 2 */}
                    <div className="p-2 rounded-xl hover:bg-white/[0.04] text-gray-400 hover:text-gray-200 flex items-center space-x-2.5 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center font-bold text-xs text-white shrink-0">
                        YT
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-xs text-gray-300 truncate">Yazılım & Tasarım</span>
                          <span className="text-[10px] text-gray-400 font-mono">16:40</span>
                        </div>
                        <p className="text-[11px] text-gray-400 truncate">Haftalık planlama tamamlandı</p>
                      </div>
                    </div>

                    {/* Channel 3 */}
                    <div className="p-2 rounded-xl hover:bg-white/[0.04] text-gray-400 hover:text-gray-200 flex items-center space-x-2.5 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-fuchsia-600 to-pink-500 flex items-center justify-center font-bold text-xs text-white shrink-0">
                        TE
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-xs text-gray-300 truncate">Turnuva Ekibi</span>
                          <span className="text-[10px] text-gray-400 font-mono">Dün</span>
                        </div>
                        <p className="text-[11px] text-gray-400 truncate">60 FPS yayın test edildi</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom User Bar */}
                <div className="pt-2 mt-2 border-t border-white/[0.08] flex items-center justify-between">
                  <div className="flex items-center space-x-2 min-w-0">
                    <div className="relative w-7 h-7 rounded-full bg-gradient-to-tr from-[#a855f7] to-[#ec4899] flex items-center justify-center font-bold text-[11px] text-white shrink-0">
                      L
                      <div className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-[#0c081c]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">Lyring</div>
                      <div className="text-[10px] text-gray-400 truncate">@lyring</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1.5 text-gray-400">
                    <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 02-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    <svg className="w-3.5 h-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 18v-6a9 9 0 0118 0v6M3 18a3 3 0 003 3h1a2 2 0 002-2v-4a2 2 0 00-2-2H4a1 1 0 00-1 1v4zm18 0a3 3 0 01-3 3h-1a2 2 0 01-2-2v-4a2 2 0 012-2h3a1 1 0 011 1v4z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* 2. Main Center Chat & Call Canvas */}
              <div className="md:col-span-12 lg:col-span-6 flex flex-col justify-between bg-[#080512] min-h-[460px]">
                {/* Chat Top Header */}
                <div className="h-12 px-4 bg-[#0d091e]/90 border-b border-white/[0.08] flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <span className="text-gray-400 font-bold text-sm">#</span>
                    <span className="font-bold text-sm text-white">Game Fedaileri</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[10px] font-medium hidden sm:inline-block">
                      4 Katılımcı
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Sesli Kanal Aktif</span>
                    </span>
                  </div>
                </div>

                {/* Chat Content Stream */}
                <div className="p-4 space-y-3 flex-1 flex flex-col justify-end">
                  {/* Active Voice Stream Frosted Card */}
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#170e35]/90 via-[#130b2e]/90 to-[#0e0724]/90 border border-[#8B51FF]/30 shadow-lg backdrop-blur-md">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-white">WebRTC P2P Canlı Ses Odası</span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono">
                          18ms • 48 kHz Opus
                        </span>
                      </div>
                      {/* Audio frequency wave visualizer */}
                      <div className="flex items-end space-x-1 h-3.5">
                        <span className="w-1 bg-[#a36eff] h-2 rounded-full animate-pulse" />
                        <span className="w-1 bg-emerald-400 h-3.5 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                        <span className="w-1 bg-[#c084fc] h-1.5 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                        <span className="w-1 bg-emerald-400 h-3 rounded-full animate-pulse" style={{ animationDelay: '450ms' }} />
                        <span className="w-1 bg-[#a36eff] h-2.5 rounded-full animate-pulse" style={{ animationDelay: '200ms' }} />
                      </div>
                    </div>

                    {/* Participant Avatars in Voice */}
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-1.5">
                        <div className="relative">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center font-bold text-[10px] text-white ring-2 ring-emerald-500 shadow-md">
                            D
                          </div>
                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400" />
                        </div>
                        <span className="text-xs text-gray-200 font-medium">Deniz</span>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <div className="relative">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center font-bold text-[10px] text-white ring-2 ring-emerald-500 shadow-md">
                            M
                          </div>
                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400" />
                        </div>
                        <span className="text-xs text-gray-200 font-medium">Mafikk</span>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <div className="relative">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#8B51FF] to-[#c084fc] flex items-center justify-center font-bold text-[10px] text-white ring-2 ring-emerald-500 shadow-md">
                            L
                          </div>
                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400" />
                        </div>
                        <span className="text-xs text-white font-semibold">Lyring (Sen)</span>
                      </div>
                    </div>
                  </div>

                  {/* Message 1 */}
                  <div className="flex items-start space-x-2.5 text-xs">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-500 flex items-center justify-center font-bold text-[10px] text-white shrink-0 mt-0.5">
                      D
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline space-x-2 mb-1">
                        <span className="font-semibold text-white">Deniz</span>
                        <span className="text-[10px] text-gray-400">18:22</span>
                      </div>
                      <div className="p-2.5 rounded-2xl rounded-tl-sm bg-white/[0.04] border border-white/[0.06] text-gray-200 leading-relaxed inline-block max-w-[90%]">
                        RNNoise yapay zeka gürültü filtresi efsane çalışıyor, arkadaki klavye sesini tamamen sildi 🎙️✨
                      </div>
                    </div>
                  </div>

                  {/* Message 2 */}
                  <div className="flex items-start space-x-2.5 text-xs">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-fuchsia-500 to-purple-600 flex items-center justify-center font-bold text-[10px] text-white shrink-0 mt-0.5">
                      M
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline space-x-2 mb-1">
                        <span className="font-semibold text-white">Mafikk</span>
                        <span className="text-[10px] text-gray-400">18:24</span>
                      </div>
                      <div className="p-2.5 rounded-2xl rounded-tl-sm bg-white/[0.04] border border-white/[0.06] text-gray-200 leading-relaxed inline-block max-w-[90%]">
                        Ses gecikmesi 18ms'ye kadar indi, stüdyo kalitesinde geliyor. Yayın açıyorum! ⚡
                      </div>
                    </div>
                  </div>

                  {/* Message 3 (Current user) */}
                  <div className="flex items-start space-x-2.5 text-xs">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#8B51FF] to-[#c084fc] flex items-center justify-center font-bold text-[10px] text-white shrink-0 mt-0.5 shadow-md">
                      L
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline space-x-2 mb-1">
                        <span className="font-semibold text-[#d8b4fe]">Lyring (Sen)</span>
                        <span className="text-[10px] text-gray-400">18:25</span>
                        <span className="px-1.5 py-0.5 rounded bg-[#8B51FF]/25 text-[#d8b4fe] text-[9px] font-bold">YÖNETİCİ</span>
                      </div>
                      <div className="p-2.5 rounded-2xl rounded-tl-sm bg-[#8B51FF]/15 border border-[#8B51FF]/30 text-white leading-relaxed inline-block max-w-[90%]">
                        1080p 60 FPS ekran paylaşımı hazır. Oyun odasında buluşalım! 🎮🚀
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Input Area */}
                <div className="p-3 bg-[#0d091e]/90 border-t border-white/[0.08]">
                  <div className="flex items-center space-x-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                    <div className="w-5 h-5 rounded-md bg-white/10 flex items-center justify-center text-gray-400 hover:text-white cursor-pointer text-xs font-bold">
                      +
                    </div>
                    <span className="text-xs text-gray-400 flex-1 truncate">
                      #Game Fedaileri kanalına mesaj gönder...
                    </span>
                    <div className="flex items-center space-x-2 text-gray-400">
                      <span className="text-sm cursor-pointer hover:scale-110 transition-transform">😊</span>
                      <div className="w-6 h-6 rounded-lg bg-[#8B51FF] hover:bg-[#7a3ef2] text-white flex items-center justify-center cursor-pointer transition-colors shadow-sm">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Right Group Members Sidebar (col-span-3) */}
              <div className="hidden lg:flex lg:col-span-3 flex-col bg-[#090616]/95 p-3.5 text-xs">
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">
                  Grup Üyeleri (4)
                </div>

                <div className="space-y-2.5">
                  {/* Member 1 */}
                  <div className="flex items-center space-x-2.5 p-1.5 rounded-xl hover:bg-white/[0.03] transition-colors">
                    <div className="relative">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#8B51FF] to-[#c084fc] flex items-center justify-center font-bold text-[10px] text-white ring-2 ring-emerald-500">
                        L
                      </div>
                      <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-[#0c081c]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-1">
                        <span className="font-semibold text-xs text-white truncate">Lyring</span>
                        <span className="text-[10px] text-amber-400">👑</span>
                      </div>
                      <div className="text-[10px] text-emerald-400 truncate">Konuşuyor...</div>
                    </div>
                  </div>

                  {/* Member 2 */}
                  <div className="flex items-center space-x-2.5 p-1.5 rounded-xl hover:bg-white/[0.03] transition-colors">
                    <div className="relative">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-500 flex items-center justify-center font-bold text-[10px] text-white ring-2 ring-emerald-500">
                        D
                      </div>
                      <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-[#0c081c]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-xs text-gray-200 truncate block">Deniz</span>
                      <div className="text-[10px] text-emerald-400 truncate">Sesli Odada</div>
                    </div>
                  </div>

                  {/* Member 3 */}
                  <div className="flex items-center space-x-2.5 p-1.5 rounded-xl hover:bg-white/[0.03] transition-colors">
                    <div className="relative">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-fuchsia-500 to-purple-600 flex items-center justify-center font-bold text-[10px] text-white">
                        M
                      </div>
                      <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-[#0c081c]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-xs text-gray-200 truncate block">Mafikk</span>
                      <div className="text-[10px] text-[#c084fc] truncate">60 FPS Yayında</div>
                    </div>
                  </div>

                  {/* Member 4 */}
                  <div className="flex items-center space-x-2.5 p-1.5 rounded-xl hover:bg-white/[0.03] transition-colors opacity-70">
                    <div className="relative">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-gray-700 to-gray-600 flex items-center justify-center font-bold text-[10px] text-gray-300">
                        H
                      </div>
                      <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-gray-500 border border-[#0c081c]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-xs text-gray-400 truncate block">Hollie</span>
                      <div className="text-[10px] text-gray-500 truncate">Çevrimdışı</div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* 3 Key Highlights Below Preview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 text-left">
          <div className="p-6 rounded-2xl bg-[#0e0920]/60 border border-white/[0.08] hover:border-[#8B51FF]/40 transition-colors backdrop-blur-md">
            <h3 className="text-base font-bold text-white mb-2">Kristal Netliğinde Ses</h3>
            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
              RNNoise yapay zeka gürültü engelleme teknolojisi ile mekanik klavye seslerini, oda yankısını ve arka plan gürültülerini tamamen yok edin.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0e0920]/60 border border-white/[0.08] hover:border-[#8B51FF]/40 transition-colors backdrop-blur-md">
            <h3 className="text-base font-bold text-white mb-2">Grup ve Özel Odalar</h3>
            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
              Arkadaşlarınızla bire bir doğrudan mesajlaşın veya dilediğiniz büyüklükte arkadaş grupları kurup sesli odalara tek tıklamayla anında katılın.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0e0920]/60 border border-white/[0.08] hover:border-[#8B51FF]/40 transition-colors backdrop-blur-md">
            <h3 className="text-base font-bold text-white mb-2">60 FPS Ultra Akıcı Yayın</h3>
            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
              Oyunlarınızı veya tüm masaüstünüzü 1080p 60 FPS hızında, sistem sesiyle birlikte donma ve takılma olmadan arkadaşlarınızla paylaşın.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Güvenlik (#security) */}
      <section id="security" className="relative z-10 py-24 px-6 sm:px-10 lg:px-16 max-w-6xl mx-auto w-full scroll-mt-20">
        <div className="text-center mb-16">
          <div className="inline-block px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-widest mb-5 backdrop-blur-sm">
            Güvenlik & Gizlilik
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
            Tavizsiz Veri Güvenliği, Mutlak Gizlilik
          </h2>
          <p className="max-w-2xl mx-auto text-sm sm:text-base text-gray-300 font-normal leading-relaxed">
            Voys, kullanıcı gizliliğini temel bir hak olarak görür. Tüm iletişiminiz modern kriptografik standartlarla korunur.
          </p>
        </div>

        {/* 3 Detailed Security Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-7 rounded-3xl bg-[#0e0920]/75 border border-white/10 hover:border-emerald-500/40 shadow-xl backdrop-blur-md flex flex-col justify-between transition-all duration-300">
            <div>
              <h3 className="text-xl font-bold text-white mb-3">Uçtan Uca Şifreli P2P</h3>
              <p className="text-xs sm:text-sm text-gray-300 leading-relaxed mb-6">
                Ses ve ekran paylaşımı doğrudan eşler arası (Peer-to-Peer) WebRTC altyapısıyla iletilir. DTLS-SRTP 256-bit şifreleme sayesinde görüşmeleriniz sunucularda asla saklanmaz veya dinlenemez.
              </p>
            </div>
            <div className="pt-4 border-t border-white/[0.08] text-xs text-emerald-400 font-medium">
              DTLS / SRTP Kriptolama
            </div>
          </div>

          <div className="p-7 rounded-3xl bg-[#0e0920]/75 border border-white/10 hover:border-emerald-500/40 shadow-xl backdrop-blur-md flex flex-col justify-between transition-all duration-300">
            <div>
              <h3 className="text-xl font-bold text-white mb-3">Kurumsal Kimlik Doğrulama</h3>
              <p className="text-xs sm:text-sm text-gray-300 leading-relaxed mb-6">
                Supabase destekli güvenli oturum yönetimi, kriptografik JWT token yapısı ve veritabanı düzeyinde Row-Level Security (RLS) politikalarıyla kullanıcı hesabınız tam koruma altındadır.
              </p>
            </div>
            <div className="pt-4 border-t border-white/[0.08] text-xs text-emerald-400 font-medium">
              Row-Level Security & JWT
            </div>
          </div>

          <div className="p-7 rounded-3xl bg-[#0e0920]/75 border border-white/10 hover:border-emerald-500/40 shadow-xl backdrop-blur-md flex flex-col justify-between transition-all duration-300">
            <div>
              <h3 className="text-xl font-bold text-white mb-3">Sıfır Veri Satışı & İzleyici</h3>
              <p className="text-xs sm:text-sm text-gray-300 leading-relaxed mb-6">
                Voys'ta sizi takip eden reklam kodları veya analiz izleyicileri bulunmaz. Profil bilgileriniz ve yazışmalarınız üçüncü taraf şirketlere asla satılmaz veya taranmaz.
              </p>
            </div>
            <div className="pt-4 border-t border-white/[0.08] text-xs text-emerald-400 font-medium">
              %100 İzleyicisiz ve Reklamsız
            </div>
          </div>
        </div>

        {/* Security Trust Banner */}
        <div className="mt-8 p-5 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-sm flex flex-wrap items-center justify-around gap-4 text-xs sm:text-sm text-gray-300 font-medium">
          <span>256-bit SSL / TLS Güvenli Bağlantı</span>
          <span className="hidden sm:block text-gray-600">•</span>
          <span>Katı Gizlilik Standartları</span>
          <span className="hidden sm:block text-gray-600">•</span>
          <span>Sıfır Günlük / Sıfır Ses Kaydı</span>
        </div>
      </section>

      {/* 5. Performans (#performance) */}
      <section id="performance" className="relative z-10 py-24 px-6 sm:px-10 lg:px-16 max-w-6xl mx-auto w-full scroll-mt-20">
        <div className="text-center mb-16">
          <div className="inline-block px-4 py-1.5 rounded-full bg-[#8B51FF]/10 border border-[#8B51FF]/20 text-[#d8b4fe] text-xs font-semibold uppercase tracking-widest mb-5 backdrop-blur-sm">
            Performans & Hız
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
            Ultra Düşük Gecikme, Maksimum Verimlilik
          </h2>
          <p className="max-w-2xl mx-auto text-sm sm:text-base text-gray-300 font-normal leading-relaxed">
            Oyun oynarken veya yoğun iş temposunda sistem kaynaklarınızı tüketmeyen, minimum bellek ve CPU ayak iziyle inşa edilmiş saf performans.
          </p>
        </div>

        {/* 4 Stat Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
          <div className="p-6 rounded-2xl bg-[#0e0920]/70 border border-white/10 backdrop-blur-md text-center">
            <div className="text-3xl sm:text-4xl font-black text-white mb-1.5 bg-gradient-to-r from-purple-400 to-[#d8b4fe] bg-clip-text text-transparent">
              &lt; 25ms
            </div>
            <div className="text-xs sm:text-sm font-semibold text-gray-200 mb-1">Ultra Düşük Gecikme</div>
            <p className="text-[11px] sm:text-xs text-gray-400">Doğrudan P2P WebRTC aktarımı</p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0e0920]/70 border border-white/10 backdrop-blur-md text-center">
            <div className="text-3xl sm:text-4xl font-black text-white mb-1.5 bg-gradient-to-r from-purple-400 to-[#d8b4fe] bg-clip-text text-transparent">
              60 FPS
            </div>
            <div className="text-xs sm:text-sm font-semibold text-gray-200 mb-1">Akıcı Ekran Yayını</div>
            <p className="text-[11px] sm:text-xs text-gray-400">Donanım hızlandırmalı video motoru</p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0e0920]/70 border border-white/10 backdrop-blur-md text-center">
            <div className="text-3xl sm:text-4xl font-black text-white mb-1.5 bg-gradient-to-r from-purple-400 to-[#d8b4fe] bg-clip-text text-transparent">
              48 kHz
            </div>
            <div className="text-xs sm:text-sm font-semibold text-gray-200 mb-1">Stüdyo Opus Sesi</div>
            <p className="text-[11px] sm:text-xs text-gray-400">Düşük bant genişliğinde netlik</p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0e0920]/70 border border-white/10 backdrop-blur-md text-center">
            <div className="text-3xl sm:text-4xl font-black text-white mb-1.5 bg-gradient-to-r from-purple-400 to-[#d8b4fe] bg-clip-text text-transparent">
              &lt; %1
            </div>
            <div className="text-xs sm:text-sm font-semibold text-gray-200 mb-1">Minimum CPU Yükü</div>
            <p className="text-[11px] sm:text-xs text-gray-400">Oyunlarda sıfır FPS kaybı</p>
          </div>
        </div>

        {/* 2 Detailed Technical Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-7 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-[#8B51FF]/40 transition-all backdrop-blur-sm">
            <h3 className="text-lg font-bold text-white mb-2">Donanım Hızlandırmalı Medya Hattı</h3>
            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
              Voys masaüstü uygulaması, ekran yakalama ve ses filtreleme görevlerini modern GPU ve CPU komut setleriyle paralel işler. Rekabetçi oyunlarınızda mikro gecikmeler veya takılmalar yaşamazsınız.
            </p>
          </div>

          <div className="p-7 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-[#8B51FF]/40 transition-all backdrop-blur-sm">
            <h3 className="text-lg font-bold text-white mb-2">Hafif Bellek (RAM) Ayak İzi</h3>
            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
              Hantal ve bellek sızdıran geleneksel sohbet uygulamalarının aksine, Voys optimize edilmiş hafif mimarisi sayesinde arka planda sessizce çalışır, bilgisayarınızı asla yavaşlatmaz.
            </p>
          </div>
        </div>
      </section>

      {/* 6. Destek (#support) */}
      <section id="support" className="relative z-10 py-24 px-6 sm:px-10 lg:px-16 max-w-6xl mx-auto w-full scroll-mt-20">
        <div className="text-center mb-16">
          <div className="inline-block px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-widest mb-5 backdrop-blur-sm">
            Destek & Yardım
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
            Her Zaman Yanınızdayız
          </h2>
          <p className="max-w-2xl mx-auto text-sm sm:text-base text-gray-300 font-normal leading-relaxed">
            Kurulum adımları, ses kalibrasyonu, topluluk rehberleri ve merak ettiğiniz her soru için buradayız.
          </p>
        </div>

        {/* 3 Support Channels */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="p-7 rounded-2xl bg-[#0e0920]/75 border border-white/10 hover:border-indigo-500/40 transition-all backdrop-blur-md flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold text-white mb-2">Topluluk Kanalları</h3>
              <p className="text-xs sm:text-sm text-gray-400 leading-relaxed mb-4">
                Voys sesli ve yazılı topluluk kanallarına katılarak diğer kullanıcılarla tanışın, deneyimlerinizi paylaşın ve anlık yardım alın.
              </p>
            </div>
            <div className="text-xs font-semibold text-indigo-300">
              Topluluğa Katıl
            </div>
          </div>

          <div className="p-7 rounded-2xl bg-[#0e0920]/75 border border-white/10 hover:border-indigo-500/40 transition-all backdrop-blur-md flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold text-white mb-2">Yardım & Rehberler</h3>
              <p className="text-xs sm:text-sm text-gray-400 leading-relaxed mb-4">
                Mikrofon yapılandırması, yapay zeka gürültü filtresi kalibrasyonu ve ekran paylaşımı ayarlarını optimize etmek için detaylı kılavuzlar.
              </p>
            </div>
            <div className="text-xs font-semibold text-indigo-300">
              Rehberleri İncele
            </div>
          </div>

          <div className="p-7 rounded-2xl bg-[#0e0920]/75 border border-white/10 hover:border-indigo-500/40 transition-all backdrop-blur-md flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold text-white mb-2">Geri Bildirim & İletişim</h3>
              <p className="text-xs sm:text-sm text-gray-400 leading-relaxed mb-4">
                Karşılaştığınız bir hatayı bildirmek veya yeni bir özellik önermek mi istiyorsunuz? Geri bildirimleriniz doğrudan geliştiricilere iletilir.
              </p>
            </div>
            <div className="text-xs font-semibold text-indigo-300">
              Hata veya Öneri Bildir
            </div>
          </div>
        </div>

        {/* Quick FAQ Grid */}
        <div className="p-8 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-sm">
          <h3 className="text-xl font-bold text-white mb-6 text-center">Sıkça Sorulan Sorular</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            <div className="p-4 rounded-xl bg-black/20 border border-white/5">
              <h4 className="text-sm font-bold text-white mb-1.5">Voys tamamen ücretsiz mi?</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Evet, Voys kristal netliğinde ses, 60 FPS ekran paylaşımı ve sınırsız sohbet özellikleri dahil olmak üzere tamamen ücretsizdir.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-black/20 border border-white/5">
              <h4 className="text-sm font-bold text-white mb-1.5">Tarayıcı ile Masaüstü uygulaması arasında fark var mı?</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Her iki platformda da aynı özellikleri kullanabilirsiniz. Masaüstü uygulaması ek olarak global bas-konuş kısayolları ve gelişmiş donanım hızlandırma sağlar.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-black/20 border border-white/5">
              <h4 className="text-sm font-bold text-white mb-1.5">Sesli görüşmelerim kaydediliyor mu?</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Hayır. Voys, eşler arası (P2P) WebRTC şifrelemesi kullanır. Ses ve ekran akışlarınız sunucularımız üzerinden depolanmaz veya kaydedilmez.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-black/20 border border-white/5">
              <h4 className="text-sm font-bold text-white mb-1.5">Kendi grubumu nasıl kurabilirim?</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Giriş yaptıktan sonra sol menüdeki grup oluşturma ikonuna tıklayarak arkadaşlarınızı davet edebilir ve hemen özel sesli kanalınızı başlatabilirsiniz.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="relative z-10 py-10 px-6 sm:px-10 lg:px-16 border-t border-white/[0.06] bg-[#07050f]/70 backdrop-blur-lg">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-4">
          <div className="flex items-center space-x-3">
            <img src="/voys_weblogo.png" alt="Voys" className="h-5 sm:h-6 w-auto object-contain opacity-90" />
            <span>•</span>
            <span>© 2026 Voys Inc. Tüm hakları saklıdır.</span>
          </div>

          <div className="flex items-center space-x-6 text-xs sm:text-sm text-gray-400 font-medium">
            <a href="#discover" className="hover:text-white transition-colors duration-200">Keşfedin</a>
            <a href="#security" className="hover:text-white transition-colors duration-200">Güvenlik</a>
            <a href="#performance" className="hover:text-white transition-colors duration-200">Performans</a>
            <a href="#support" className="hover:text-white transition-colors duration-200">Destek</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
