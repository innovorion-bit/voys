import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Download,
  Monitor,
  Mic,
  Volume2,
  Users,
  MessageSquare,
  Radio,
  Sparkles,
  Zap,
  Shield,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Play,
  Headphones,
  Check,
  Flame,
  Layers,
  Cpu,
  Smile,
  Bell,
  Trash2,
  Share2,
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
  Crown
} from 'lucide-react';

const GithubIcon = ({ size = 16, className = '' }) => (
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
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);
import { useAuth } from '../context/useAuth';

export const LandingPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [openFaq, setOpenFaq] = useState(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const toggleFaq = (idx) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  const directExeUrl = 'https://github.com/innovorion-bit/voys/releases/download/v1.0.0/Voys_1.0.0_x64-setup.exe';
  const directMsiUrl = 'https://github.com/innovorion-bit/voys/releases/download/v1.0.0/Voys_1.0.0_x64_en-US.msi';
  const githubReleaseUrl = 'https://github.com/innovorion-bit/voys/releases/tag/v1.0.0';

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

  const faqs = [
    {
      q: 'Voys tamamen ücretsiz mi?',
      a: 'Evet! Voys tamamen ücretsiz ve reklamsızdır. Ses kanalları, grup sohbetleri, ekran paylaşımı ve yapay zeka destekli gürültü engelleme dahil tüm özellikler herhangi bir kısıtlama olmadan kullanılabilir.'
    },
    {
      q: 'Web sürümü ile masaüstü uygulaması arasındaki fark nedir?',
      a: 'Web sürümü indirme gerektirmeden modern tarayıcılarda anında çalışır. Windows masaüstü uygulaması ise oyun oynarken bas-konuş (Push-to-Talk) kısayollarını sistem genelinde dinleme, oynadığınız oyunu otomatik algılama ve arka planda minimum RAM tüketimi avantajı sağlar.'
    },
    {
      q: 'Masaüstü uygulaması neden bu kadar hızlı ve hafif?',
      a: 'Voys, Electron yerine modern Rust tabanlı Tauri mimarisi kullanır. Bu sayede Discord gibi 300-500 MB RAM harcamak yerine yalnızca 60-80 MB bellek kullanır ve saniyeler içinde başlatılır.'
    },
    {
      q: 'RNNoise Yapay Zeka Gürültü Engelleme nasıl çalışır?',
      a: 'Ses iletimi sırasında mikrofonunuzdan gelen ses gerçek zamanlı olarak RNNoise nöral ağ filtresinden geçirilir. Klavye mekanik sesleri, arka plandaki fan gürültüleri ve ortam yankıları sıfıra indirilerek yalnızca berrak insan sesi iletilir.'
    },
    {
      q: 'Hangi işletim sistemlerini destekliyor?',
      a: 'Masaüstü uygulamamız şu anda Windows 10 ve Windows 11 (64-bit) sistemlerle tam uyumludur. Web sürümümüz ise Windows, macOS, Linux ve tüm mobil tarayıcılardan doğrudan erişilebilir.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#070709] text-gray-200 selection:bg-[#8B51FF]/40 selection:text-white font-sans antialiased overflow-x-hidden relative">
      {/* Dynamic Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[550px] bg-gradient-to-b from-[#8B51FF]/15 via-[#6366f1]/5 to-transparent blur-[120px] pointer-events-none -z-10" />
      <div className="absolute top-[800px] -left-40 w-[600px] h-[600px] bg-[#8B51FF]/10 blur-[140px] pointer-events-none -z-10" />
      <div className="absolute top-[1600px] -right-40 w-[700px] h-[700px] bg-[#6366f1]/10 blur-[150px] pointer-events-none -z-10" />

      {/* 1. Header / Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#070709]/80 border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="relative">
              <img
                src="/voys_logo.png"
                alt="Voys Logo"
                className="w-8 h-8 object-contain transition-transform group-hover:scale-105"
              />
              <div className="absolute -inset-1 bg-[#8B51FF]/30 blur-sm rounded-full -z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-xl tracking-tight text-white">Voys</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#8B51FF]/20 text-[#a36eff] border border-[#8B51FF]/30">
                v1.0.0
              </span>
            </div>
          </Link>

          {/* Nav Links (Desktop) */}
          <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-gray-300">
            <a href="#features" className="hover:text-white transition-colors">Özellikler</a>
            <a href="#voice-ai" className="hover:text-white transition-colors">Ses & AI</a>
            <a href="#performance" className="hover:text-white transition-colors">Performans</a>
            <a href="#download" className="hover:text-white transition-colors">İndir</a>
            <a href="#faq" className="hover:text-white transition-colors">SSS</a>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => navigate('/channel/home')}
                className="text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-white border border-white/10 transition-all flex items-center space-x-1.5"
              >
                <span>Uygulamaya Git</span>
                <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-xs sm:text-sm font-medium px-3.5 py-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/[0.06] transition-all"
              >
                Giriş Yap
              </button>
            )}

            <button
              type="button"
              onClick={() => handleDownloadClick(directExeUrl)}
              className="text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl bg-gradient-to-r from-[#8B51FF] to-[#7033ea] hover:from-[#9b66ff] hover:to-[#7e40f5] text-white shadow-lg shadow-[#8B51FF]/25 hover:shadow-[#8B51FF]/40 transition-all flex items-center space-x-2 cursor-pointer"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Windows için</span>
              <span>İndir</span>
            </button>
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
      <section className="relative pt-16 sm:pt-24 pb-20 sm:pb-28 px-4 sm:px-6 lg:px-8 text-center max-w-5xl mx-auto">
        {/* Pill Badge */}
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-[#8B51FF]/10 border border-[#8B51FF]/30 text-[#c299ff] text-xs font-semibold mb-6 shadow-sm">
          <Sparkles size={13} className="text-[#a36eff] animate-pulse" />
          <span>Voys Masaüstü v1.0.0 Yayında — Ücretsiz ve Hızlı</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white mb-6 leading-[1.1]">
          Birlikte Konuşmak, Oynamak ve Paylaşmak İçin{' '}
          <span className="bg-gradient-to-r from-[#a36eff] via-[#c084fc] to-[#e879f9] bg-clip-text text-transparent">
            Yepyeni Bir Boyut.
          </span>
        </h1>

        {/* Hero Subtitle */}
        <p className="max-w-2xl mx-auto text-base sm:text-lg text-gray-300 font-normal leading-relaxed mb-10">
          Düşük gecikmeli WebRTC ses kanalları, yapay zeka destekli arka plan gürültü filtresi, 
          60 FPS ekran paylaşımı ve kesintisiz grup sohbetleri. Arkadaşların ve topluluğun için özel alanın.
        </p>

        {/* Hero CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto mb-14">
          {/* Main Direct Download CTA */}
          <button
            type="button"
            onClick={() => handleDownloadClick(directExeUrl)}
            className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-gradient-to-r from-[#8B51FF] via-[#8144ff] to-[#6d28d9] hover:from-[#9b66ff] hover:to-[#7c3aed] text-white font-bold text-base shadow-xl shadow-[#8B51FF]/30 hover:shadow-[#8B51FF]/50 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center space-x-3 cursor-pointer group"
          >
            <Download size={19} className="group-hover:-translate-y-0.5 transition-transform" />
            <div className="text-left">
              <div className="leading-tight">Windows için İndir</div>
              <div className="text-[11px] font-normal text-purple-200/80">64-bit .exe • 3.2 MB</div>
            </div>
          </button>

          {/* Open in Browser CTA */}
          <button
            type="button"
            onClick={() => navigate(isAuthenticated ? '/channel/home' : '/login')}
            className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-[#121217] hover:bg-[#1a1a22] border border-white/10 hover:border-white/20 text-white font-bold text-base shadow-lg transition-all flex items-center justify-center space-x-2.5 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            <Monitor size={18} className="text-gray-400" />
            <span>Voys'u Tarayıcında Aç</span>
            <ArrowRight size={16} className="text-gray-400 ml-1" />
          </button>
        </div>

        {/* Small trust badges */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-gray-400 font-medium">
          <div className="flex items-center space-x-1.5">
            <CheckCircle2 size={14} className="text-emerald-400" />
            <span>Windows 10 / 11 64-Bit Uyumlu</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <CheckCircle2 size={14} className="text-emerald-400" />
            <span>Reklamsız & Tamamen Ücretsiz</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <CheckCircle2 size={14} className="text-emerald-400" />
            <span>Hafif Kurulum (3.2 MB)</span>
          </div>
        </div>

        {/* 3. Hero App Mockup / Visualizer */}
        <div className="mt-16 sm:mt-20 relative max-w-5xl mx-auto">
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

                  {/* Active Chat Item: Game Fedaileri */}
                  <div className="p-2.5 rounded-xl bg-white/[0.05] border border-[#8B51FF]/40 flex items-center space-x-3 cursor-pointer shadow-lg shadow-black/20">
                    <div className="relative shrink-0">
                      <img
                        src="/mock/avatar_fedai.png"
                        alt="Game Fedaileri"
                        className="w-10 h-10 rounded-full object-cover border border-purple-500/30"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-bold text-white truncate">Game Fedaileri</span>
                        <div className="text-[10px] text-gray-500 text-right leading-none shrink-0 ml-1">
                          <div>22:57</div>
                          <div className="text-[9px] text-gray-600 mt-0.5">14.11.2026</div>
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-400 truncate">
                        <span className="text-gray-300 font-medium">Trust:</span> ben de çıktım aga...
                      </p>
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
                      <div className="text-[10px] text-gray-400 leading-tight">6 üye, 1 çevrimiçi</div>
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

                {/* Messages Stream */}
                <div className="p-3.5 sm:p-4 space-y-3 text-xs overflow-y-auto max-h-[380px]">
                  {/* Msg 1: Lyring with link */}
                  <div className="space-y-0.5">
                    <div className="flex items-baseline space-x-1.5">
                      <span className="font-bold text-[#b682ff]">Lyring</span>
                      <span className="text-[10px] text-gray-500 font-mono">01:43</span>
                    </div>
                    <div className="text-[11px] text-indigo-400 hover:text-indigo-300 underline underline-offset-2 break-all leading-relaxed flex items-start gap-1">
                      <span>https://studio.tripo3d.ai/3d-model/mass-of-screaming-humanoid-heads-and-bodies-intertwined-stone-marble-41f36821-8d00-4ffa-9451-9eeda9029eae</span>
                      <ExternalLink size={11} className="inline shrink-0 mt-0.5" />
                    </div>
                  </div>

                  {/* Msg 2: Lyring with link */}
                  <div className="space-y-0.5">
                    <div className="flex items-baseline space-x-1.5">
                      <span className="font-bold text-[#b682ff]">Lyring</span>
                      <span className="text-[10px] text-gray-500 font-mono">01:47</span>
                    </div>
                    <div className="text-[11px] text-indigo-400 hover:text-indigo-300 underline underline-offset-2 break-all leading-relaxed flex items-start gap-1">
                      <span>https://www.reddit.com/r/consoles/comments/1hpj1zw/ps5_custom_design_tlou/?tl=tr</span>
                      <ExternalLink size={11} className="inline shrink-0 mt-0.5" />
                    </div>
                  </div>

                  {/* Msg 3: Yedx */}
                  <div className="space-y-0.5">
                    <div className="flex items-baseline space-x-1.5">
                      <span className="font-bold text-[#84cc16]">Yedx</span>
                      <span className="text-[10px] text-gray-500 font-mono">01:55</span>
                    </div>
                    <p className="text-gray-200 text-xs">emoo</p>
                  </div>

                  {/* Date Separator */}
                  <div className="flex items-center my-2.5">
                    <div className="flex-1 h-px bg-white/[0.08]" />
                    <span className="px-3 text-[10px] text-gray-500 font-medium">14 Kasım 2026 Cumartesi</span>
                    <div className="flex-1 h-px bg-white/[0.08]" />
                  </div>

                  {/* Msg 4: Lyring */}
                  <div className="space-y-0.5">
                    <div className="flex items-baseline space-x-1.5">
                      <span className="font-bold text-[#b682ff]">Lyring</span>
                      <span className="text-[10px] text-gray-500 font-mono">01:39</span>
                    </div>
                    <p className="text-gray-200 text-xs">sa</p>
                  </div>

                  {/* Msg 5: Trust */}
                  <div className="space-y-0.5">
                    <div className="flex items-baseline space-x-1.5">
                      <span className="font-bold text-[#a3e635]">Trust</span>
                      <span className="text-[10px] text-gray-500 font-mono">22:57</span>
                    </div>
                    <p className="text-gray-200 text-xs">ben de çıktım agalar görüşürüz</p>
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
                    <span className="text-gray-500 select-none">Mesaj gönder...</span>
                    <div className="flex items-center space-x-2">
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
                    GRUP ÜYELERİ
                  </span>
                  <button
                    type="button"
                    className="text-xs text-[#a36eff] hover:text-[#c084fc] font-semibold inline-flex items-center space-x-1 cursor-pointer transition"
                  >
                    <Plus size={13} />
                    <span>Ekle</span>
                  </button>
                </div>

                {/* Member List */}
                <div className="p-3 space-y-2.5 text-xs overflow-y-auto">
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
                        <span className="text-[9.5px] bg-[#8B51FF]/30 border border-[#8B51FF]/40 text-purple-200 px-1 py-0.2 rounded font-medium">
                          Sen
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-400">Çevrimiçi</div>
                    </div>
                  </div>

                  {/* Rain */}
                  <div className="flex items-center space-x-2.5 opacity-80">
                    <div className="relative shrink-0">
                      <img
                        src="/mock/avatar_rain.png"
                        alt="Rain"
                        className="w-8 h-8 rounded-full object-cover border border-white/10 grayscale-[30%]"
                      />
                      <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-gray-500 border border-[#09090c]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-gray-300 text-xs truncate">Rain</div>
                      <div className="text-[10px] text-gray-500">Çevrimdışı</div>
                    </div>
                  </div>

                  {/* Mafik */}
                  <div className="flex items-center space-x-2.5 opacity-80">
                    <div className="relative shrink-0">
                      <div className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center font-bold text-gray-400 text-xs">
                        M
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-gray-500 border border-[#09090c]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-gray-300 text-xs truncate">Mafik</div>
                      <div className="text-[10px] text-gray-500">Çevrimdışı</div>
                    </div>
                  </div>

                  {/* Trust */}
                  <div className="flex items-center space-x-2.5 opacity-80">
                    <div className="relative shrink-0">
                      <div className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center font-bold text-gray-400 text-xs">
                        T
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-gray-500 border border-[#09090c]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-gray-300 text-xs truncate">Trust</div>
                      <div className="text-[10px] text-gray-500">Çevrimdışı</div>
                    </div>
                  </div>

                  {/* Hollie */}
                  <div className="flex items-center space-x-2.5 opacity-80">
                    <div className="relative shrink-0">
                      <div className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center font-bold text-gray-400 text-xs">
                        H
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-gray-500 border border-[#09090c]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-gray-300 text-xs truncate">Hollie</div>
                      <div className="text-[10px] text-gray-500">Çevrimdışı</div>
                    </div>
                  </div>

                  {/* Yedx */}
                  <div className="flex items-center space-x-2.5 opacity-80">
                    <div className="relative shrink-0">
                      <div className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center font-bold text-gray-400 text-xs">
                        Y
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-gray-500 border border-[#09090c]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-gray-300 text-xs truncate">Yedx</div>
                      <div className="text-[10px] text-gray-500">Çevrimdışı</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Core Features Showcase Grid */}
      <section id="features" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/[0.06]">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-xs font-bold tracking-widest text-[#a36eff] uppercase mb-3">
            Gelişmiş Özellikler
          </h2>
          <h3 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-5">
            İletişiminizi Güçlendiren Her Şey Tek Bir Yerde.
          </h3>
          <p className="text-gray-400 text-base sm:text-lg">
            Gereksiz karmaşıklıktan uzak, performansa ve berrak sese odaklanmış modern iletişim platformu.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1 */}
          <div className="p-8 rounded-2xl bg-gradient-to-b from-white/[0.05] to-transparent border border-white/[0.08] hover:border-[#8B51FF]/40 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-[#8B51FF]/20 border border-[#8B51FF]/40 flex items-center justify-center text-[#a36eff] mb-6 group-hover:scale-110 transition-transform">
              <Mic size={24} />
            </div>
            <h4 className="text-xl font-bold text-white mb-3">RNNoise AI Gürültü Engelleme</h4>
            <p className="text-gray-400 text-sm leading-relaxed">
              Mekanik klavye tıklamaları, kasa fanları ve arka plan gürültüsü WebAssembly nöral ağ filtresi ile anında temizlenir.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-8 rounded-2xl bg-gradient-to-b from-white/[0.05] to-transparent border border-white/[0.08] hover:border-[#8B51FF]/40 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 mb-6 group-hover:scale-110 transition-transform">
              <Zap size={24} />
            </div>
            <h4 className="text-xl font-bold text-white mb-3">Ultra Düşük Gecikmeli P2P</h4>
            <p className="text-gray-400 text-sm leading-relaxed">
              WebRTC teknolojisi sayesinde ses paketleri doğrudan peer-to-peer iletilir; gecikme sıfıra yakın seviyede kalır.
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-8 rounded-2xl bg-gradient-to-b from-white/[0.05] to-transparent border border-white/[0.08] hover:border-[#8B51FF]/40 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 mb-6 group-hover:scale-110 transition-transform">
              <Share2 size={24} />
            </div>
            <h4 className="text-xl font-bold text-white mb-3">60 FPS Ekran & Ses Paylaşımı</h4>
            <p className="text-gray-400 text-sm leading-relaxed">
              Oyunlarınızı veya masaüstünüzü sistem sesiyle birlikte yüksek kare hızında arkadaşlarınızla canlı paylaşın.
            </p>
          </div>

          {/* Card 4 */}
          <div className="p-8 rounded-2xl bg-gradient-to-b from-white/[0.05] to-transparent border border-white/[0.08] hover:border-[#8B51FF]/40 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-6 group-hover:scale-110 transition-transform">
              <Radio size={24} />
            </div>
            <h4 className="text-xl font-bold text-white mb-3">Sistem Geneli Bas-Konuş</h4>
            <p className="text-gray-400 text-sm leading-relaxed">
              Masaüstü uygulaması ile arka plandayken veya tam ekran oyun oynarken bile tanımladığınız tuşla rahatça konuşun.
            </p>
          </div>

          {/* Card 5 */}
          <div className="p-8 rounded-2xl bg-gradient-to-b from-white/[0.05] to-transparent border border-white/[0.08] hover:border-[#8B51FF]/40 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-6 group-hover:scale-110 transition-transform">
              <MessageSquare size={24} />
            </div>
            <h4 className="text-xl font-bold text-white mb-3">Zengin Sohbet & Okundu Tikleri</h4>
            <p className="text-gray-400 text-sm leading-relaxed">
              Tek tık (iletildi), mor çift tık (okundu) bildirimleri, zengin emoji seçici, dosya yükleme ve mesaj silme özellikleri.
            </p>
          </div>

          {/* Card 6 */}
          <div className="p-8 rounded-2xl bg-gradient-to-b from-white/[0.05] to-transparent border border-white/[0.08] hover:border-[#8B51FF]/40 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mb-6 group-hover:scale-110 transition-transform">
              <Cpu size={24} />
            </div>
            <h4 className="text-xl font-bold text-white mb-3">Ultra Hafif Rust Motoru</h4>
            <p className="text-gray-400 text-sm leading-relaxed">
              Electron hantallığına son. Tauri ile inşa edilmiş Voys, yalnızca 60-80 MB RAM harcar ve bilgisayarınızı yormaz.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Performance Comparison Section */}
      <section id="performance" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto border-t border-white/[0.06]">
        <div className="text-center mb-14">
          <h2 className="text-xs font-bold tracking-widest text-[#a36eff] uppercase mb-3">
            Hafiflik & Performans
          </h2>
          <h3 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Neden Voys Tercih Edilmeli?
          </h3>
        </div>

        <div className="bg-[#0e0e13] border border-white/[0.1] rounded-2xl overflow-hidden shadow-2xl">
          <div className="grid grid-cols-3 bg-[#14141c] p-4 sm:p-5 border-b border-white/[0.08] text-xs sm:text-sm font-bold text-gray-300">
            <div>Özellik</div>
            <div className="text-center text-[#a36eff] font-extrabold">Voys Masaüstü</div>
            <div className="text-center text-gray-400">Geleneksel Uygulamalar (Discord vb.)</div>
          </div>

          <div className="divide-y divide-white/[0.06] text-xs sm:text-sm">
            <div className="grid grid-cols-3 p-4 sm:p-5 items-center">
              <span className="font-medium text-gray-300">RAM (Bellek) Tüketimi</span>
              <span className="text-center font-bold text-emerald-400">~60 - 80 MB ⚡</span>
              <span className="text-center text-rose-400/90 font-medium">350 - 650 MB</span>
            </div>

            <div className="grid grid-cols-3 p-4 sm:p-5 items-center">
              <span className="font-medium text-gray-300">Kurulum Dosya Boyutu</span>
              <span className="text-center font-bold text-emerald-400">3.2 MB (Hızlı Kurulum)</span>
              <span className="text-center text-gray-400 font-medium">90 - 150 MB</span>
            </div>

            <div className="grid grid-cols-3 p-4 sm:p-5 items-center">
              <span className="font-medium text-gray-300">AI Gürültü Engelleme</span>
              <span className="text-center font-bold text-emerald-400">Yerleşik RNNoise AI</span>
              <span className="text-center text-gray-300 font-medium">Üçüncü Parti Eklenti</span>
            </div>

            <div className="grid grid-cols-3 p-4 sm:p-5 items-center">
              <span className="font-medium text-gray-300">Oyun Algılama (Rich Presence)</span>
              <span className="text-center font-bold text-emerald-400">Var (Otomatik)</span>
              <span className="text-center text-gray-300 font-medium">Var</span>
            </div>

            <div className="grid grid-cols-3 p-4 sm:p-5 items-center">
              <span className="font-medium text-gray-300">Tarayıcıda Çalışma Desteği</span>
              <span className="text-center font-bold text-emerald-400">Tek Tıkla Tarayıcıda Aç</span>
              <span className="text-center text-gray-300 font-medium">Sınırlı Web İstemcisi</span>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Dedicated Download Center Section */}
      <section id="download" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto border-t border-white/[0.06] text-center">
        <div className="relative p-8 sm:p-14 rounded-3xl bg-gradient-to-b from-[#141224] to-[#0c0a14] border border-[#8B51FF]/40 shadow-2xl overflow-hidden">
          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#8B51FF]/20 rounded-full blur-[90px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/20 rounded-full blur-[90px] pointer-events-none" />

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">
            Voys'u Hemen İndirin.
          </h2>
          <p className="max-w-xl mx-auto text-sm sm:text-base text-gray-300 mb-8 leading-relaxed">
            Windows 10 ve 11 için optimize edilmiş en son kurulum paketini indirin, 
            arkadaşlarınızla anında sesli ve yazılı iletişimin tadını çıkarın.
          </p>

          {/* Download Action Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto mb-8">
            {/* Primary EXE Card */}
            <div className="p-6 rounded-2xl bg-[#19162e] border border-[#8B51FF]/50 text-left hover:border-[#a36eff] transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#8B51FF]/30 text-[#c299ff]">
                    Önerilen
                  </span>
                  <span className="text-xs text-gray-400 font-mono">v1.0.0</span>
                </div>
                <h4 className="text-lg font-bold text-white mb-1">Windows (.exe Kurulumu)</h4>
                <p className="text-xs text-gray-400 mb-5">Standart kurulum sihirbazı. 64-bit Windows 10 & 11.</p>
              </div>

              <button
                type="button"
                onClick={() => handleDownloadClick(directExeUrl)}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#8B51FF] to-[#7033ea] hover:from-[#9b66ff] hover:to-[#7e40f5] text-white font-bold text-sm shadow-lg shadow-[#8B51FF]/25 flex items-center justify-center space-x-2 transition cursor-pointer"
              >
                <Download size={16} />
                <span>Hemen İndir (.exe)</span>
              </button>
            </div>

            {/* MSI Card */}
            <div className="p-6 rounded-2xl bg-[#12111d] border border-white/[0.08] text-left hover:border-white/20 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/[0.08] text-gray-300">
                    Alternatif
                  </span>
                  <span className="text-xs text-gray-400 font-mono">v1.0.0</span>
                </div>
                <h4 className="text-lg font-bold text-white mb-1">Windows MSI Paketi</h4>
                <p className="text-xs text-gray-400 mb-5">Kurumsal ve doğrudan Windows Installer (.msi) paketi.</p>
              </div>

              <button
                type="button"
                onClick={() => handleDownloadClick(directMsiUrl)}
                className="w-full py-3 px-4 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-white font-bold text-sm border border-white/10 flex items-center justify-center space-x-2 transition cursor-pointer"
              >
                <Download size={16} />
                <span>MSI İndir (.msi)</span>
              </button>
            </div>
          </div>

          {/* GitHub Source & Releases link */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-400">
            <span>Kurulum yapmak istemiyor musunuz?</span>
            <Link
              to={isAuthenticated ? '/channel/home' : '/login'}
              className="text-[#a36eff] hover:underline font-semibold flex items-center space-x-1"
            >
              <span>Voys Web Sürümünü Kullanın</span>
              <ArrowRight size={13} />
            </Link>
            <span className="text-gray-600">•</span>
            <a
              href={githubReleaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white flex items-center space-x-1 hover:underline"
            >
              <GithubIcon size={13} />
              <span>GitHub Releases</span>
              <ExternalLink size={11} />
            </a>
          </div>
        </div>
      </section>

      {/* 7. FAQ Section */}
      <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto border-t border-white/[0.06]">
        <div className="text-center mb-14">
          <h2 className="text-xs font-bold tracking-widest text-[#a36eff] uppercase mb-3">
            Merak Edilenler
          </h2>
          <h3 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Sıkça Sorulan Sorular
          </h3>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="rounded-2xl bg-white/[0.02] border border-white/[0.08] overflow-hidden transition-colors"
            >
              <button
                type="button"
                onClick={() => toggleFaq(idx)}
                className="w-full p-5 text-left font-semibold text-gray-200 flex items-center justify-between hover:text-white transition cursor-pointer"
              >
                <span className="text-sm sm:text-base">{faq.q}</span>
                {openFaq === idx ? (
                  <ChevronUp size={18} className="text-[#a36eff] flex-shrink-0 ml-3" />
                ) : (
                  <ChevronDown size={18} className="text-gray-400 flex-shrink-0 ml-3" />
                )}
              </button>
              {openFaq === idx && (
                <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-gray-400 leading-relaxed border-t border-white/[0.04]">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 8. Footer */}
      <footer className="border-t border-white/[0.08] bg-[#050507] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-3">
            <img src="/voys_logo.png" alt="Voys Logo" className="w-6 h-6 object-contain" />
            <span className="font-extrabold text-base text-white">Voys</span>
            <span className="text-xs text-gray-400">© 2026 Voys Inc. Tüm hakları saklıdır.</span>
          </div>

          <div className="flex items-center space-x-6 text-xs text-gray-400 font-medium">
            <a href="#features" className="hover:text-white transition">Özellikler</a>
            <a href="#download" className="hover:text-white transition">İndir</a>
            <Link to="/login" className="hover:text-white transition">Giriş Yap</Link>
            <a
              href="https://github.com/innovorion-bit/voys"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition flex items-center space-x-1"
            >
              <GithubIcon size={14} />
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
