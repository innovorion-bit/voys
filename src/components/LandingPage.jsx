import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Download,
  Monitor,
  Users,
  ArrowRight,
  CheckCircle2,
  Smile,
  Phone,
  MoreVertical,
  Search,
  Plus,
  Send,
  HelpCircle,
  Minus,
  Square,
  X,
  SlidersHorizontal,
  ArrowLeft,
  Crown,
  FileText,
  CheckCheck
} from 'lucide-react';
import { useAuth } from '../context/useAuth';

export const LandingPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const directExeUrl = 'https://github.com/innovorion-bit/voys/releases/download/v1.0.0/Voys_1.0.0_x64-setup.exe';

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
    <div className="min-h-screen bg-[#070709] text-gray-200 selection:bg-[#8B51FF]/40 selection:text-white font-sans antialiased overflow-x-hidden relative">
      {/* Dynamic Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[550px] bg-gradient-to-b from-[#8B51FF]/15 via-[#6366f1]/5 to-transparent blur-[120px] pointer-events-none -z-10" />
      <div className="absolute top-[400px] -left-40 w-[600px] h-[600px] bg-[#8B51FF]/10 blur-[140px] pointer-events-none -z-10" />

      {/* 1. Header / Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#070709]/80">
        <div className="w-full px-6 sm:px-10 lg:px-16 h-20 flex items-center justify-between relative">
          {/* Logo & Brand (Far Left) */}
          <Link to="/" className="flex items-center group shrink-0 z-10" title="Voys">
            <div className="relative">
              <img
                src="/voys_logo.png"
                alt="Voys Logo"
                className="w-9 h-9 object-contain transition-transform group-hover:scale-105"
              />
              <div className="absolute -inset-1 bg-[#8B51FF]/30 blur-sm rounded-full -z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </Link>

          {/* Nav Links - Menüler (True Center) */}
          <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-gray-300 absolute left-1/2 -translate-x-1/2">
            <a href="#features" className="hover:text-white transition-colors">Özellikler</a>
            <a href="#voice-ai" className="hover:text-white transition-colors">Ses & AI</a>
            <a href="#performance" className="hover:text-white transition-colors">Performans</a>
            <a href="#download" className="hover:text-white transition-colors">İndir</a>
            <a href="#faq" className="hover:text-white transition-colors">SSS</a>
          </nav>

          {/* Action Buttons - Giriş Yap Only (Far Right) */}
          <div className="flex items-center shrink-0 z-10">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => navigate('/channel/home')}
                className="text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-white border border-white/10 transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <span>Uygulamaya Git</span>
                <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-xs sm:text-sm font-semibold px-5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/10 hover:border-white/20 transition-all cursor-pointer"
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

      {/* 2. Hero Section */}
      <section className="relative pt-8 sm:pt-14 pb-16 sm:pb-24 px-6 sm:px-10 lg:px-16 xl:px-20 max-w-[1536px] mx-auto text-left">
        {/* Top Split: Title/Subtitle on Left, Compact Mockup on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 xl:gap-14 items-center">
          {/* Left Column: Title & Subtitle (Küçültülmüş boyut, sağa kaydırılmış padding) */}
          <div className="lg:col-span-5 xl:col-span-5 lg:pl-2 xl:pl-4">
            {/* Hero Title */}
            <h1 className="text-3xl sm:text-4xl lg:text-[42px] xl:text-[46px] font-extrabold tracking-tight text-white mb-5 leading-[1.16]">
              Birlikte Konuşmak ve Paylaşmak İçin{' '}
              <span className="inline-block bg-gradient-to-r from-[#a36eff] via-[#c084fc] to-[#e879f9] bg-clip-text text-transparent">
                Yepyeni Bir Boyut.
              </span>
            </h1>

            {/* Hero Subtitle */}
            <p className="text-sm sm:text-base text-gray-300 font-normal leading-relaxed max-w-lg">
              Düşük gecikmeli ses kanalları, yapay zeka destekli arka plan gürültü filtresi,
              60 FPS ekran paylaşımı ve kesintisiz grup sohbetleri. Arkadaşların ve topluluğun için özel alanın.
            </p>
          </div>

          {/* Right Column: Compact App Mockup ("Test Ekranı", sade içerikler) */}
          <div className="lg:col-span-7 xl:col-span-7 relative">

        {/* Ambient Window Glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-[#8B51FF]/25 via-indigo-500/15 to-purple-600/25 rounded-3xl blur-xl opacity-70 -z-10" />

            {/* Mockup Frame */}
            <div className="bg-[#0c0c10] border border-white/[0.12] rounded-2xl shadow-2xl overflow-hidden text-left relative font-sans">
              {/* Top Custom Window Header */}
              <div className="h-9 bg-[#08080a] border-b border-white/[0.08] px-3 flex items-center justify-between select-none">
                {/* Left: Brand */}
                <div className="flex items-center space-x-2 pl-1">
                  <img
                    src="/voys_logo.png"
                    alt="Voys"
                    className="h-4 w-auto object-contain pointer-events-none select-none"
                  />
                  <span className="text-[11px] font-semibold text-gray-400">Voys</span>
                </div>

                {/* Center: Window Title */}
                <div className="text-xs font-semibold text-gray-300 tracking-wide">
                  Grup Sohbeti
                </div>

                {/* Right: Controls */}
                <div className="flex items-center space-x-1">
                  <div
                    className="w-7 h-6 flex items-center justify-center text-purple-400 hover:text-purple-300 hover:bg-[#8B51FF]/20 rounded transition cursor-pointer mr-1"
                    title="Yardım"
                  >
                    <HelpCircle size={13} />
                  </div>
                  <div className="w-8 h-6 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded transition cursor-pointer">
                    <Minus size={12} />
                  </div>
                  <div className="w-8 h-6 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded transition cursor-pointer">
                    <Square size={10} />
                  </div>
                  <div className="w-8 h-6 flex items-center justify-center text-gray-400 hover:text-white hover:bg-rose-500 rounded transition cursor-pointer">
                    <X size={12} />
                  </div>
                </div>
              </div>

              {/* Inner Interface: 2-Column Clean Layout */}
              <div className="grid grid-cols-12 min-h-[350px] bg-[#0c0c10]">
                {/* Left Sidebar: Sohbetler */}
                <div className="col-span-5 sm:col-span-4 border-r border-white/[0.08] bg-[#0e0e12] flex flex-col justify-between">
                  <div className="p-2.5">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                        Sohbetler
                      </span>
                      <button
                        type="button"
                        className="text-gray-400 hover:text-white transition"
                        title="Yeni Sohbet"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    {/* Chat List */}
                    <div className="space-y-1">
                      {/* Active: Game Fedaileri */}
                      <div className="p-2 rounded-xl bg-white/[0.08] border border-[#8B51FF]/40 flex items-center space-x-2.5 cursor-pointer shadow-sm">
                        <div className="relative shrink-0">
                          <img
                            src="/mock/avatar_fedai.png"
                            alt="Game Fedaileri"
                            className="w-8 h-8 rounded-full object-cover border border-purple-500/40"
                          />
                          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-[#0e0e12]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white truncate">Game Fedaileri</span>
                            <span className="text-[9px] text-gray-500 font-mono">21:08</span>
                          </div>
                          <p className="text-[10px] text-gray-400 truncate">Udinese: 2 dk'ya geldim 🔥</p>
                        </div>
                      </div>

                      {/* DM 1: Emirhan */}
                      <div className="p-2 rounded-xl hover:bg-white/[0.04] flex items-center space-x-2.5 cursor-pointer transition">
                        <div className="relative shrink-0">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-[11px] shadow-inner">
                            EM
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-[#0e0e12]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-300 truncate">Emirhan</span>
                            <span className="text-[9px] text-gray-500 font-mono">20:42</span>
                          </div>
                          <p className="text-[10px] text-gray-400 truncate flex items-center gap-1">
                            <CheckCheck size={11} className="text-[#a36eff] shrink-0" />
                            <span>Ses çok net geliyor</span>
                          </p>
                        </div>
                      </div>

                      {/* DM 2: Udinese */}
                      <div className="p-2 rounded-xl hover:bg-white/[0.04] flex items-center space-x-2.5 cursor-pointer transition">
                        <div className="relative shrink-0">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-indigo-800 flex items-center justify-center font-bold text-white text-[11px] shadow-inner">
                            UD
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-[#0e0e12]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-300 truncate">Udinese</span>
                            <span className="text-[9px] text-gray-500 font-mono">Dün</span>
                          </div>
                          <p className="text-[10px] text-gray-400 truncate">Yarın yayını açalım</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Profile (Lyring) */}
                  <div className="border-t border-white/[0.08] p-2 flex items-center justify-between bg-[#0a0a0d]">
                    <div className="flex items-center space-x-2 min-w-0">
                      <div className="relative shrink-0">
                        <img
                          src="/mock/avatar_lyring.png"
                          alt="Lyring"
                          className="w-7 h-7 rounded-full object-cover"
                        />
                        <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-[#0a0a0d]" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-white leading-tight truncate">Lyring</div>
                        <div className="text-[9px] text-gray-400">@lyring</div>
                      </div>
                    </div>
                    <SlidersHorizontal size={13} className="text-gray-400 hover:text-white cursor-pointer shrink-0" />
                  </div>
                </div>

                {/* Right Chat Area */}
                <div className="col-span-7 sm:col-span-8 flex flex-col justify-between bg-[#0b0b0e]">
                  {/* Chat Top Header */}
                  <div className="h-10 border-b border-white/[0.08] px-3 flex items-center justify-between bg-[#0c0c10]/80">
                    <div className="flex items-center space-x-2 min-w-0">
                      <img
                        src="/mock/avatar_fedai.png"
                        alt="Game Fedaileri"
                        className="w-6 h-6 rounded-full object-cover border border-purple-500/20 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white leading-tight truncate">Game Fedaileri</div>
                        <div className="text-[9px] text-gray-400 leading-tight flex items-center space-x-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                          <span>4 çevrimiçi</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <div
                        className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-white rounded hover:bg-white/10 transition cursor-pointer"
                        title="Sesli Arama"
                      >
                        <Phone size={13} />
                      </div>
                      <div
                        className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-white rounded hover:bg-white/10 transition cursor-pointer"
                        title="Seçenekler"
                      >
                        <MoreVertical size={13} />
                      </div>
                    </div>
                  </div>

                  {/* Messages: Clean, Sade, Turkish */}
                  <div className="p-3 space-y-2.5 text-xs overflow-y-auto max-h-[260px]">
                    {/* Msg 1 */}
                    <div className="space-y-0.5">
                      <div className="flex items-baseline space-x-1.5">
                        <span className="font-bold text-[#b682ff] text-[11px]">Rain</span>
                        <span className="text-[9px] text-gray-500 font-mono">21:05</span>
                      </div>
                      <p className="text-gray-200 text-xs leading-relaxed">
                        Beyler turnuva maçı için toplanıyoruz değil mi? Lobi hazır, ses kanalına geçelim 🎮
                      </p>
                    </div>

                    {/* Msg 2 */}
                    <div className="space-y-0.5">
                      <div className="flex items-baseline space-x-1.5">
                        <span className="font-bold text-emerald-400 text-[11px]">Emirhan</span>
                        <span className="text-[9px] text-gray-500 font-mono">21:06</span>
                      </div>
                      <p className="text-gray-200 text-xs leading-relaxed">
                        Geliyorum kanka, RNNoise açık klavye ve arka plan sesi sıfır tertemiz 👌
                      </p>
                    </div>

                    {/* Msg 3 */}
                    <div className="space-y-0.5">
                      <div className="flex items-baseline space-x-1.5">
                        <span className="font-bold text-[#c084fc] text-[11px]">Lyring</span>
                        <span className="text-[8.5px] bg-[#8B51FF]/30 border border-[#8B51FF]/40 text-purple-200 px-1 rounded font-medium">
                          Sen
                        </span>
                        <span className="text-[9px] text-gray-500 font-mono">21:07</span>
                      </div>
                      <p className="text-gray-200 text-xs leading-relaxed">
                        Odayı açtım bekliyorum, WebRTC ile ses gecikmesi neredeyse sıfır.
                      </p>
                    </div>

                    {/* Msg 4 */}
                    <div className="space-y-0.5">
                      <div className="flex items-baseline space-x-1.5">
                        <span className="font-bold text-indigo-400 text-[11px]">Udinese</span>
                        <span className="text-[9px] text-gray-500 font-mono">21:08</span>
                      </div>
                      <p className="text-gray-200 text-xs leading-relaxed">
                        2 dakikaya oyundayım geldim beyler 🔥
                      </p>
                    </div>
                  </div>

                  {/* Bottom Chat Bar */}
                  <div className="p-2.5 pt-1 flex items-center space-x-2">
                    <div className="flex-1 bg-[#14141a] border border-white/[0.08] rounded-xl px-3 py-1.5 flex items-center justify-between text-xs">
                      <span className="text-gray-500 select-none text-[11px] truncate">
                        Game Fedaileri grubuna mesaj gönder...
                      </span>
                      <div className="flex items-center space-x-1.5 ml-1.5">
                        <Smile size={14} className="text-amber-400 hover:scale-110 cursor-pointer transition shrink-0" />
                        <Send size={13} className="text-gray-400 hover:text-white cursor-pointer transition shrink-0" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hero CTA Buttons - Sayfaya tam ortalanmış ve yan yana */}
        <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5 mt-12 sm:mt-16">
          {/* Main Direct Download CTA */}
          <button
            type="button"
            onClick={() => handleDownloadClick(directExeUrl)}
            className="w-full sm:w-[260px] h-[54px] rounded-2xl bg-gradient-to-r from-[#8B51FF] via-[#8144ff] to-[#6d28d9] hover:from-[#9b66ff] hover:to-[#7c3aed] text-white font-bold text-sm sm:text-base shadow-xl shadow-[#8B51FF]/30 hover:shadow-[#8B51FF]/50 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center space-x-2.5 cursor-pointer group whitespace-nowrap"
          >
            <Download size={19} className="group-hover:-translate-y-0.5 transition-transform shrink-0" />
            <span>Windows için İndir</span>
          </button>

          {/* Open in Browser CTA */}
          <button
            type="button"
            onClick={() => navigate(isAuthenticated ? '/channel/home' : '/login')}
            className="w-full sm:w-[260px] h-[54px] rounded-2xl bg-[#121217] hover:bg-[#1a1a22] border border-white/10 hover:border-white/20 text-white font-bold text-sm sm:text-base shadow-lg transition-all flex items-center justify-center space-x-2.5 cursor-pointer hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
          >
            <Monitor size={18} className="text-gray-400 shrink-0" />
            <span>Voys'u Tarayıcında Aç</span>
            <ArrowRight size={16} className="text-gray-400 ml-0.5 shrink-0" />
          </button>
        </div>
      </section>
    </div>
  );
};
