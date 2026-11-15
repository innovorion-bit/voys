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

      {/* 2. Hero Section (Left-aligned title, text and buttons) */}
      <section className="relative pt-12 sm:pt-20 pb-20 sm:pb-28 px-6 sm:px-10 lg:px-16 w-full text-left">
        {/* Hero Title (Left-aligned) */}
        <h1 className="max-w-4xl text-4xl sm:text-5xl md:text-6xl lg:text-[72px] font-extrabold tracking-tight text-white mb-6 leading-[1.1] text-left">
          Paylaşmak İçin{' '}
          <span className="inline-block bg-gradient-to-r from-[#a36eff] via-[#c084fc] to-[#e879f9] bg-clip-text text-transparent">
            Yepyeni Bir Boyut.
          </span>
        </h1>

        {/* Hero Subtitle (Left-aligned) */}
        <p className="max-w-2xl text-base sm:text-lg md:text-xl text-gray-300 font-normal leading-relaxed mb-10 text-left">
          Düşük gecikmeli ses kanalları, yapay zeka destekli arka plan gürültü filtresi,
          60 FPS ekran paylaşımı ve kesintisiz grup sohbetleri. Arkadaşların ve topluluğun için özel alanın.
        </p>

        {/* Hero CTA Buttons - Left Aligned & Matching Dimensions */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-start gap-4 sm:gap-5 mb-16">
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

        {/* 3. Hero App Mockup / Visualizer */}
        <div className="mt-8 relative max-w-6xl mx-auto">
          {/* Ambient Window Glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-[#8B51FF]/30 via-indigo-500/20 to-purple-600/30 rounded-3xl blur-2xl opacity-70 -z-10" />

          {/* Mockup Frame */}
          <div className="bg-[#0c0c10] border border-white/[0.12] rounded-2xl shadow-2xl overflow-hidden text-left relative font-sans">
            {/* Top Windows Custom Window Header */}
            <div className="h-9 bg-[#08080a] border-b border-white/[0.08] px-3 flex items-center justify-between select-none">
              {/* Left: Voys Brand Logo */}
              <div className="flex items-center space-x-2 pl-1">
                <img
                  src="/voys_logo.png"
                  alt="Voys"
                  className="h-4 w-auto object-contain pointer-events-none select-none"
                />
              </div>

              {/* Center: Window Title */}
              <div className="text-xs font-semibold text-gray-300 tracking-wide">
                Grup Sohbeti
              </div>

              {/* Right: Windows Controls & Help Button */}
              <div className="flex items-center space-x-1">
                <div
                  className="w-7 h-6 flex items-center justify-center text-purple-400 hover:text-purple-300 hover:bg-[#8B51FF]/20 rounded transition cursor-pointer mr-1"
                  title="Yardım (Rehber Videosu)"
                >
                  <HelpCircle size={14} />
                </div>
                <div className="w-8 h-6 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded transition cursor-pointer">
                  <Minus size={13} />
                </div>
                <div className="w-8 h-6 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded transition cursor-pointer">
                  <Square size={11} />
                </div>
                <div className="w-8 h-6 flex items-center justify-center text-gray-400 hover:text-white hover:bg-rose-500 rounded transition cursor-pointer">
                  <X size={13} />
                </div>
              </div>
            </div>

            {/* Inner Voys App 3-Column Interface */}
            <div className="grid grid-cols-12 min-h-[480px] bg-[#0c0c10]">
              {/* 1. Left Sidebar: Chats, Search, User Profile (3 cols desktop, hidden on tiny mobile) */}
              <div className="hidden sm:flex sm:col-span-4 lg:col-span-3 border-r border-white/[0.08] bg-[#0e0e12] flex-col justify-between">
                <div className="p-3">
                  {/* Search and Action Buttons */}
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="flex-1 bg-[#15151c] border border-white/[0.06] rounded-xl px-2.5 py-1.5 flex items-center space-x-2 text-xs text-gray-400">
                      <Search size={14} className="text-gray-500 shrink-0" />
                      <span className="truncate">Sohbet arayın...</span>
                    </div>
                    <button
                      type="button"
                      className="w-8 h-8 rounded-xl bg-[#181822] border border-white/[0.06] hover:bg-white/[0.08] flex items-center justify-center text-gray-400 hover:text-white shrink-0 transition cursor-default"
                      title="Kişiler"
                    >
                      <Users size={14} />
                    </button>
                    <button
                      type="button"
                      className="w-8 h-8 rounded-xl bg-[#181822] border border-white/[0.06] hover:bg-white/[0.08] flex items-center justify-center text-gray-400 hover:text-white shrink-0 transition cursor-default"
                      title="Yeni Sohbet"
                    >
                      <Plus size={15} />
                    </button>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center space-x-1.5 mb-3">
                    <span className="px-3 py-1 rounded-full bg-[#8B51FF] text-white text-xs font-semibold shadow-sm shadow-[#8B51FF]/30 cursor-pointer">
                      Tümü
                    </span>
                    <span className="px-3 py-1 rounded-full text-gray-400 hover:text-white text-xs font-medium cursor-pointer transition">
                      Kişiler
                    </span>
                    <span className="px-3 py-1 rounded-full text-gray-400 hover:text-white text-xs font-medium cursor-pointer transition">
                      Gruplar
                    </span>
                  </div>

                  {/* Chat List - Both Groups and Direct Chats (DMs) */}
                  <div className="space-y-1.5">
                    {/* Active Group Chat: Game Fedaileri */}
                    <div className="p-2.5 rounded-xl bg-white/[0.06] border border-[#8B51FF]/40 flex items-center space-x-3 cursor-pointer shadow-lg shadow-black/20">
                      <div className="relative shrink-0">
                        <img
                          src="/mock/avatar_fedai.png"
                          alt="Game Fedaileri"
                          className="w-10 h-10 rounded-full object-cover border border-purple-500/40"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-bold text-white truncate">Game Fedaileri</span>
                          <span className="text-[10px] text-gray-500 font-mono shrink-0 ml-1">21:15</span>
                        </div>
                        <p className="text-[11px] text-gray-400 truncate">
                          <span className="text-gray-300 font-medium">Emirhan:</span> Akşam turnuva maçımız var 🔥
                        </p>
                      </div>
                    </div>

                    {/* Direct Message (DM): Emirhan */}
                    <div className="p-2.5 rounded-xl hover:bg-white/[0.03] border border-transparent hover:border-white/[0.05] flex items-center space-x-3 cursor-pointer transition">
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-xs shadow-inner">
                          EM
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#0e0e12]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-semibold text-gray-200 truncate">Emirhan</span>
                          <span className="text-[10px] text-gray-500 font-mono shrink-0 ml-1">20:42</span>
                        </div>
                        <p className="text-[11px] text-gray-400 truncate flex items-center gap-1">
                          <CheckCheck size={13} className="text-[#a36eff] shrink-0" />
                          <span>Ses kalitesi gerçekten çok netti 👌</span>
                        </p>
                      </div>
                    </div>

                    {/* Community Group Chat: Voys Topluluk */}
                    <div className="p-2.5 rounded-xl hover:bg-white/[0.03] border border-transparent hover:border-white/[0.05] flex items-center space-x-3 cursor-pointer transition">
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-full bg-[#8B51FF]/20 border border-[#8B51FF]/40 flex items-center justify-center p-1.5 shadow-inner">
                          <img src="/voys_logo.png" alt="Voys" className="w-full h-full object-contain" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-semibold text-gray-200 truncate">Voys Duyurular & Sohbet</span>
                          <span className="text-[10px] text-gray-500 font-mono shrink-0 ml-1">18:30</span>
                        </div>
                        <p className="text-[11px] text-gray-400 truncate">
                          <span className="text-gray-300 font-medium">Rain:</span> Yeni gürültü filtresi yayında!
                        </p>
                      </div>
                    </div>

                    {/* Direct Message (DM): Udinese */}
                    <div className="p-2.5 rounded-xl hover:bg-white/[0.03] border border-transparent hover:border-white/[0.05] flex items-center space-x-3 cursor-pointer transition">
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-indigo-800 flex items-center justify-center font-bold text-white text-xs shadow-inner">
                          UD
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#0e0e12]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-semibold text-gray-200 truncate">Udinese</span>
                          <span className="text-[10px] text-gray-500 font-mono shrink-0 ml-1">Dün</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] text-gray-400 truncate">
                            Yarın ekran paylaşımıyla yayını açalım.
                          </p>
                          <span className="text-[10px] bg-[#8B51FF] text-white font-bold px-1.5 py-0.2 rounded-full shrink-0 ml-1">
                            1
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom User Profile Bar (Lyring) */}
                <div className="border-t border-white/[0.08] p-3 flex items-center justify-between bg-[#0a0a0d]">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src="/mock/avatar_lyring.png"
                        alt="Lyring"
                        className="w-9 h-9 rounded-full object-cover border border-white/10"
                      />
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#0a0a0d]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white leading-tight truncate">Lyring</div>
                      <div className="text-[10px] text-gray-400">@lyring</div>
                    </div>
                  </div>
                  <div className="flex items-center text-gray-400 hover:text-white cursor-pointer transition pl-1">
                    <SlidersHorizontal size={15} />
                  </div>
                </div>
              </div>

              {/* 2. Middle Main Chat Area (7 cols on desktop, 12 on mobile) */}
              <div className="col-span-12 sm:col-span-8 lg:col-span-6 flex flex-col justify-between bg-[#0b0b0e]">
                {/* Chat Top Header */}
                <div className="h-12 border-b border-white/[0.08] px-3.5 flex items-center justify-between select-none bg-[#0c0c10]/70 backdrop-blur-sm">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <ArrowLeft size={16} className="text-gray-400 hover:text-white cursor-pointer shrink-0" />
                    <img
                      src="/mock/avatar_fedai.png"
                      alt="Game Fedaileri"
                      className="w-8 h-8 rounded-full object-cover border border-purple-500/20 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white leading-tight truncate">Game Fedaileri</div>
                      <div className="text-[10px] text-gray-400 leading-tight flex items-center space-x-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                        <span>8 üye, 4 çevrimiçi</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      type="button"
                      className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition"
                      title="Sesli Arama Başlat"
                    >
                      <Phone size={15} />
                    </button>
                    <button
                      type="button"
                      className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition"
                      title="Seçenekler"
                    >
                      <MoreVertical size={15} />
                    </button>
                  </div>
                </div>

                {/* Messages Stream - Rich Demo Turkish Conversations */}
                <div className="p-3.5 sm:p-4 space-y-3.5 text-xs overflow-y-auto max-h-[390px]">
                  {/* Msg 1: Rain */}
                  <div className="space-y-0.5">
                    <div className="flex items-baseline space-x-1.5">
                      <span className="font-bold text-[#b682ff]">Rain</span>
                      <span className="text-[10px] text-gray-500 font-mono">20:55</span>
                    </div>
                    <p className="text-gray-200 text-xs leading-relaxed">
                      Beyler bu akşam turnuva maçı için toplanıyoruz değil mi? Lobi hazır, ses kanalına geçelim 🎮
                    </p>
                  </div>

                  {/* Msg 2: Udinese */}
                  <div className="space-y-0.5">
                    <div className="flex items-baseline space-x-1.5">
                      <span className="font-bold text-indigo-400">Udinese</span>
                      <span className="text-[10px] text-gray-500 font-mono">20:58</span>
                    </div>
                    <p className="text-gray-200 text-xs leading-relaxed">
                      Geliyorum 5 dakikaya! Bu arada Voys'un arka plan gürültü filtresi aşırı iyi çalışıyor, mekanik klavye sesim geliyor mu hiç?
                    </p>
                  </div>

                  {/* Msg 3: Emirhan */}
                  <div className="space-y-0.5">
                    <div className="flex items-baseline space-x-1.5">
                      <span className="font-bold text-emerald-400">Emirhan</span>
                      <span className="text-[10px] text-gray-500 font-mono">21:02</span>
                    </div>
                    <p className="text-gray-200 text-xs leading-relaxed">
                      Sıfır ses kanka, RNNoise arkadaki tüm fan ve tuş seslerini kesmiş, sesin stüdyo mikrofonu gibi tertemiz geliyor 👌
                    </p>
                  </div>

                  {/* Date Separator */}
                  <div className="flex items-center my-2.5">
                    <div className="flex-1 h-px bg-white/[0.08]" />
                    <span className="px-3 text-[10px] text-gray-500 font-medium">Bugün</span>
                    <div className="flex-1 h-px bg-white/[0.08]" />
                  </div>

                  {/* Msg 4: Lyring (You / Sen) + File Attachment */}
                  <div className="space-y-1.5">
                    <div className="flex items-baseline space-x-1.5">
                      <span className="font-bold text-[#c084fc]">Lyring</span>
                      <span className="text-[9.5px] bg-[#8B51FF]/30 border border-[#8B51FF]/40 text-purple-200 px-1 rounded font-medium">
                        Sen
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono">21:08</span>
                    </div>
                    <p className="text-gray-200 text-xs leading-relaxed">
                      P2P WebRTC mimarisi sayesinde ses gecikmesi neredeyse sıfır. Akşamki Mirage taktik şemasını da şuraya bırakıyorum, herkes baksın:
                    </p>
                    {/* Modern File Attachment Card */}
                    <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-[#8B51FF]/40 transition max-w-sm flex items-center justify-between shadow-sm">
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-[#8B51FF]/20 border border-[#8B51FF]/30 flex items-center justify-center text-[#a36eff] shrink-0">
                          <FileText size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white truncate">CS2_Mirage_Taktik_Plani.png</div>
                          <div className="text-[10px] text-gray-400">4.2 MB • Görsel Dosyası</div>
                        </div>
                      </div>
                      <span className="text-[11px] text-[#a36eff] hover:underline font-semibold cursor-pointer shrink-0 ml-2">
                        İndir
                      </span>
                    </div>
                  </div>

                  {/* Msg 5: Mafik */}
                  <div className="space-y-0.5">
                    <div className="flex items-baseline space-x-1.5">
                      <span className="font-bold text-amber-400">Mafik</span>
                      <span className="text-[10px] text-gray-500 font-mono">21:12</span>
                    </div>
                    <p className="text-gray-200 text-xs leading-relaxed">
                      Taktik şeması çok iyi olmuş, herkes toplandıysa sesli odaya geçelim başlayalım 🚀
                    </p>
                  </div>
                </div>

                {/* Bottom Chat Input Bar */}
                <div className="p-3 pt-1.5 flex items-center space-x-2">
                  <button
                    type="button"
                    className="w-9 h-9 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.06] flex items-center justify-center text-gray-400 hover:text-white shrink-0 transition"
                  >
                    <Plus size={16} />
                  </button>
                  <div className="flex-1 bg-[#14141a] border border-white/[0.08] rounded-xl px-3.5 py-2 flex items-center justify-between text-xs">
                    <span className="text-gray-500 select-none truncate">Game Fedaileri grubuna mesaj gönder...</span>
                    <div className="flex items-center space-x-2 ml-2">
                      <Smile size={16} className="text-amber-400 hover:scale-110 cursor-pointer transition shrink-0" />
                      <Send size={15} className="text-gray-400 hover:text-white cursor-pointer transition shrink-0" />
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Right Sidebar: Group Members ("Grup Üyeleri") (3 cols desktop, hidden on small screens) */}
              <div className="hidden lg:flex lg:col-span-3 border-l border-white/[0.08] bg-[#09090c] flex-col justify-start">
                {/* Header */}
                <div className="p-3.5 pb-2 border-b border-white/[0.06] flex items-center justify-between text-xs">
                  <span className="font-bold text-gray-300 uppercase tracking-wider text-[11px]">
                    GRUP ÜYELERİ (8)
                  </span>
                  <button
                    type="button"
                    className="text-xs text-[#a36eff] hover:text-[#c084fc] font-semibold inline-flex items-center space-x-1 cursor-pointer transition"
                  >
                    <Plus size={13} />
                    <span>Ekle</span>
                  </button>
                </div>

                {/* Member List with Status Sections */}
                <div className="p-3 space-y-3 text-xs overflow-y-auto">
                  {/* Category: ÇEVRİMİÇİ */}
                  <div>
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                      Çevrimiçi — 4
                    </div>
                    <div className="space-y-2">
                      {/* Lyring (Sen, Crown) */}
                      <div className="flex items-center space-x-2.5">
                        <div className="relative shrink-0">
                          <img
                            src="/mock/avatar_lyring.png"
                            alt="Lyring"
                            className="w-8 h-8 rounded-full object-cover border border-white/10"
                          />
                          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-[#09090c]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-1">
                            <span className="font-bold text-white text-xs truncate">Lyring</span>
                            <Crown size={12} className="text-amber-400 shrink-0" />
                            <span className="text-[9px] bg-[#8B51FF]/30 border border-[#8B51FF]/40 text-purple-200 px-1 rounded font-medium">
                              Sen
                            </span>
                          </div>
                          <div className="text-[10px] text-emerald-400">Çevrimiçi</div>
                        </div>
                      </div>

                      {/* Rain */}
                      <div className="flex items-center space-x-2.5">
                        <div className="relative shrink-0">
                          <img
                            src="/mock/avatar_rain.png"
                            alt="Rain"
                            className="w-8 h-8 rounded-full object-cover border border-white/10"
                          />
                          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-[#09090c]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-gray-200 text-xs truncate">Rain</div>
                          <div className="text-[10px] text-purple-400">🎮 CS2 Oynuyor</div>
                        </div>
                      </div>

                      {/* Emirhan */}
                      <div className="flex items-center space-x-2.5">
                        <div className="relative shrink-0">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-xs shadow-inner">
                            EM
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-[#09090c]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-gray-200 text-xs truncate">Emirhan</div>
                          <div className="text-[10px] text-gray-400">☕ Sohbet & Mola</div>
                        </div>
                      </div>

                      {/* Udinese */}
                      <div className="flex items-center space-x-2.5">
                        <div className="relative shrink-0">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-indigo-800 flex items-center justify-center font-bold text-white text-xs shadow-inner">
                            UD
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-[#09090c]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-gray-200 text-xs truncate">Udinese</div>
                          <div className="text-[10px] text-indigo-300">🎧 Ses Kanalında</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Category: ÇEVRİMDAŞI */}
                  <div className="pt-2 border-t border-white/[0.04]">
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                      Çevrimdışı — 4
                    </div>
                    <div className="space-y-2 opacity-75">
                      {/* Mafik */}
                      <div className="flex items-center space-x-2.5">
                        <div className="relative shrink-0">
                          <div className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center font-bold text-gray-400 text-xs">
                            M
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-gray-500 border border-[#09090c]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-gray-400 text-xs truncate">Mafik</div>
                          <div className="text-[10px] text-gray-600">15 dk önce</div>
                        </div>
                      </div>

                      {/* Trust */}
                      <div className="flex items-center space-x-2.5">
                        <div className="relative shrink-0">
                          <div className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center font-bold text-gray-400 text-xs">
                            T
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-gray-500 border border-[#09090c]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-gray-400 text-xs truncate">Trust</div>
                          <div className="text-[10px] text-gray-600">1 saat önce</div>
                        </div>
                      </div>

                      {/* Hollie */}
                      <div className="flex items-center space-x-2.5">
                        <div className="relative shrink-0">
                          <div className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center font-bold text-gray-400 text-xs">
                            H
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-gray-500 border border-[#09090c]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-gray-400 text-xs truncate">Hollie</div>
                          <div className="text-[10px] text-gray-600">Dün</div>
                        </div>
                      </div>

                      {/* Yedx */}
                      <div className="flex items-center space-x-2.5">
                        <div className="relative shrink-0">
                          <div className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center font-bold text-gray-400 text-xs">
                            Y
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-gray-500 border border-[#09090c]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-gray-400 text-xs truncate">Yedx</div>
                          <div className="text-[10px] text-gray-600">Dün</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
