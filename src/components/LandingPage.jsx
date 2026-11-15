import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Download,
  Monitor,
  ArrowRight,
  CheckCircle2
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
    <div
      className="min-h-screen text-gray-200 selection:bg-[#8B51FF]/40 selection:text-white font-sans antialiased overflow-x-hidden relative flex flex-col justify-between"
      style={{
        backgroundImage: "url('/voys_backgraund.png')",
        backgroundColor: '#070709',
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Fixed Full-Size Background Layer */}
      <div
        className="fixed inset-0 w-full h-full pointer-events-none z-0"
        style={{
          backgroundImage: "url('/voys_backgraund.png')",
          backgroundSize: '100% 100%',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* 1. Header / Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#070709]/50 pt-4 sm:pt-6 pb-2">
        <div className="w-full px-6 sm:px-10 lg:px-16 h-16 sm:h-20 flex items-center justify-between relative">
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

          {/* Nav Links - Yeni Menüler (True Center) */}
          <nav className="hidden md:flex items-center space-x-3.5 lg:space-x-6 xl:space-x-8 text-sm font-medium text-gray-300 absolute left-1/2 -translate-x-1/2 whitespace-nowrap">
            <a href="#discover" className="hover:text-white transition-colors">Keşfedin</a>
            <a href="#security" className="hover:text-white transition-colors">Güvenlik</a>
            <a href="#features" className="hover:text-white transition-colors">Özellikler</a>
            <a href="#support" className="hover:text-white transition-colors">Destek</a>
            <a href="#developers" className="hover:text-white transition-colors">Geliştiriciler</a>
            <a href="#performance" className="hover:text-white transition-colors">Performans</a>
            <button
              type="button"
              onClick={() => handleDownloadClick(directExeUrl)}
              className="hover:text-white transition-colors cursor-pointer"
            >
              İndir
            </button>
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

      {/* 2. Hero Section (Centered headline, subtitle and buttons) */}
      <section className="relative z-10 flex-1 flex flex-col items-center justify-center pt-16 sm:pt-24 pb-24 sm:pb-36 px-6 sm:px-10 lg:px-16 max-w-5xl mx-auto text-center">
        {/* Hero Title */}
        <h1 className="max-w-4xl text-4xl sm:text-5xl md:text-6xl lg:text-[68px] font-extrabold tracking-tight text-white mb-6 leading-[1.12] text-center">
          Birlikte Konuşmak ve Paylaşmak İçin{' '}
          <span className="inline-block bg-gradient-to-r from-[#a36eff] via-[#c084fc] to-[#e879f9] bg-clip-text text-transparent">
            Yepyeni Bir Boyut.
          </span>
        </h1>

        {/* Hero Subtitle */}
        <p className="max-w-2xl text-base sm:text-lg md:text-xl text-gray-300 font-normal leading-relaxed mb-12 text-center">
          Düşük gecikmeli ses kanalları, yapay zeka destekli arka plan gürültü filtresi,
          60 FPS ekran paylaşımı ve kesintisiz grup sohbetleri. Arkadaşların ve topluluğun için özel alanın.
        </p>

        {/* Hero CTA Buttons - Sayfaya tam ortalanmış ve yan yana */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5 w-full">
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
