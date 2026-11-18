import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Download,
  Monitor,
  ArrowRight,
  CheckCircle2,
  Headphones,
  Users,
  Sparkles,
  Shield,
  Zap,
  Lock,
  Cpu,
  Code2,
  HelpCircle,
  Radio,
  Check
} from 'lucide-react';
import { useAuth } from '../context/useAuth';

export const LandingPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const bgLayerRef = useRef(null);

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

  // Discord-style background parallax descent:
  // As the user scrolls down the webpage, the 3240px background slowly and smoothly
  // pans down through its celestial layers, aligning with each section of content.
  useEffect(() => {
    let ticking = false;
    let currentScale = Math.max(1, window.innerWidth / 1920);
    let bgW = 1920 * currentScale;
    let bgH = 3240 * currentScale;

    const updateDimensionsAndPosition = () => {
      currentScale = Math.max(1, window.innerWidth / 1920);
      bgW = 1920 * currentScale;
      bgH = 3240 * currentScale;
      if (bgLayerRef.current) {
        bgLayerRef.current.style.width = `${bgW}px`;
        bgLayerRef.current.style.height = `${bgH}px`;
      }
      onScroll();
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (bgLayerRef.current) {
            const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
            const scrollHeight = document.documentElement.scrollHeight;
            const clientHeight = window.innerHeight;
            const maxScroll = Math.max(1, scrollHeight - clientHeight);
            const progress = Math.min(1, Math.max(0, scrollY / maxScroll));
            const maxTravel = Math.max(0, bgH - clientHeight);
            const targetY = -progress * maxTravel;
            bgLayerRef.current.style.transform = `translate3d(-50%, ${targetY}px, 0)`;
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    updateDimensionsAndPosition();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', updateDimensionsAndPosition);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', updateDimensionsAndPosition);
    };
  }, []);

  return (
    <div className="w-full min-h-[3240px] text-gray-200 selection:bg-[#8B51FF]/40 selection:text-white font-sans antialiased overflow-x-hidden relative flex flex-col justify-between bg-[#07050f] scroll-smooth">
      {/* Discord-style Parallax Background: Fixed viewport canvas that slowly descends as user scrolls */}
      <div className="fixed inset-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <div
          ref={bgLayerRef}
          className="absolute left-1/2 will-change-transform"
          style={{
            width: '1920px',
            height: '3240px',
            backgroundImage: "url('/voys_hero_bg.jpg?v=3')",
            backgroundSize: '100% 100%',
            backgroundRepeat: 'no-repeat',
            transform: 'translate3d(-50%, 0px, 0)',
          }}
        />
        {/* Subtle ambient lighting vignette overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#07050f]/60 pointer-events-none" />
      </div>
      {/* 1. Header / Navbar */}
      <header className="sticky top-0 z-50 bg-transparent pt-4 sm:pt-6 pb-2">
        <div className="w-full px-6 sm:px-10 lg:px-16 h-14 sm:h-16 flex items-center justify-between relative">
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

          {/* Nav Links - True Center with Purple Button Hover Animation */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2 xl:space-x-2.5 text-sm font-medium absolute left-1/2 -translate-x-1/2 whitespace-nowrap">
            <a
              href="#discover"
              className="px-3.5 py-1.5 rounded-xl text-gray-200 hover:text-white hover:bg-[#8B51FF] hover:shadow-lg hover:shadow-[#8B51FF]/30 transition-all duration-200 ease-out"
            >
              Keşfedin
            </a>
            <a
              href="#security"
              className="px-3.5 py-1.5 rounded-xl text-gray-200 hover:text-white hover:bg-[#8B51FF] hover:shadow-lg hover:shadow-[#8B51FF]/30 transition-all duration-200 ease-out"
            >
              Güvenlik
            </a>
            <a
              href="#performance"
              className="px-3.5 py-1.5 rounded-xl text-gray-200 hover:text-white hover:bg-[#8B51FF] hover:shadow-lg hover:shadow-[#8B51FF]/30 transition-all duration-200 ease-out"
            >
              Performans
            </a>
            <a
              href="#support"
              className="px-3.5 py-1.5 rounded-xl text-gray-200 hover:text-white hover:bg-[#8B51FF] hover:shadow-lg hover:shadow-[#8B51FF]/30 transition-all duration-200 ease-out"
            >
              Destek
            </a>
            <button
              type="button"
              onClick={() => handleDownloadClick(directExeUrl)}
              className="px-3.5 py-1.5 rounded-xl text-gray-200 hover:text-white hover:bg-[#8B51FF] hover:shadow-lg hover:shadow-[#8B51FF]/30 transition-all duration-200 ease-out cursor-pointer"
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
                className="text-xs sm:text-sm font-bold px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-white hover:bg-gray-100 text-gray-900 shadow-md hover:shadow-lg transition-all flex items-center space-x-1.5 cursor-pointer active:scale-95"
              >
                <span>Uygulamaya Git</span>
                <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-xs sm:text-sm font-bold px-5 sm:px-6 py-2 sm:py-2.5 rounded-xl bg-white hover:bg-gray-100 text-gray-900 shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
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
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-[#8B51FF]/15 border border-[#8B51FF]/30 text-[#d8b4fe] text-xs font-semibold uppercase tracking-wider mb-5">
          <Sparkles size={14} className="text-[#a36eff]" />
          <span>Keşfedin</span>
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

          {/* Screenshot Container */}
          <div className="relative overflow-hidden bg-[#07050f]/80 p-2 sm:p-4">
            <img
              src="/mock/voys_app_screenshot.png"
              alt="Voys App Preview"
              className="w-full h-auto rounded-xl border border-white/10 shadow-2xl transition-transform duration-500 group-hover:scale-[1.01]"
            />
          </div>
        </div>

        {/* 3 Key Highlights Below Preview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 text-left">
          <div className="p-6 rounded-2xl bg-[#0e0920]/60 border border-white/[0.08] hover:border-[#8B51FF]/40 transition-colors backdrop-blur-md">
            <div className="w-11 h-11 rounded-xl bg-[#8B51FF]/15 border border-[#8B51FF]/30 flex items-center justify-center text-[#c084fc] mb-4">
              <Headphones size={22} />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Kristal Netliğinde Ses</h3>
            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
              RNNoise yapay zeka gürültü engelleme teknolojisi ile mekanik klavye seslerini, oda yankısını ve arka plan gürültülerini tamamen yok edin.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0e0920]/60 border border-white/[0.08] hover:border-[#8B51FF]/40 transition-colors backdrop-blur-md">
            <div className="w-11 h-11 rounded-xl bg-[#8B51FF]/15 border border-[#8B51FF]/30 flex items-center justify-center text-[#c084fc] mb-4">
              <Users size={22} />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Grup ve Özel Odalar</h3>
            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
              Arkadaşlarınızla bire bir doğrudan mesajlaşın veya dilediğiniz büyüklükte arkadaş grupları kurup sesli odalara tek tıklamayla anında katılın.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0e0920]/60 border border-white/[0.08] hover:border-[#8B51FF]/40 transition-colors backdrop-blur-md">
            <div className="w-11 h-11 rounded-xl bg-[#8B51FF]/15 border border-[#8B51FF]/30 flex items-center justify-center text-[#c084fc] mb-4">
              <Monitor size={22} />
            </div>
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
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-5">
            <Shield size={14} className="text-emerald-400" />
            <span>Güvenlik & Gizlilik</span>
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
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-6">
                <Lock size={24} />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Uçtan Uca Şifreli P2P</h3>
              <p className="text-xs sm:text-sm text-gray-300 leading-relaxed mb-6">
                Ses ve ekran paylaşımı doğrudan eşler arası (Peer-to-Peer) WebRTC altyapısıyla iletilir. DTLS-SRTP 256-bit şifreleme sayesinde görüşmeleriniz sunucularda asla saklanmaz veya dinlenemez.
              </p>
            </div>
            <div className="pt-4 border-t border-white/[0.08] flex items-center space-x-2 text-xs text-emerald-400 font-medium">
              <Check size={14} />
              <span>DTLS / SRTP Kriptolama</span>
            </div>
          </div>

          <div className="p-7 rounded-3xl bg-[#0e0920]/75 border border-white/10 hover:border-emerald-500/40 shadow-xl backdrop-blur-md flex flex-col justify-between transition-all duration-300">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-6">
                <Shield size={24} />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Kurumsal Kimlik Doğrulama</h3>
              <p className="text-xs sm:text-sm text-gray-300 leading-relaxed mb-6">
                Supabase destekli güvenli oturum yönetimi, kriptografik JWT token yapısı ve veritabanı düzeyinde Row-Level Security (RLS) politikalarıyla kullanıcı hesabınız tam koruma altındadır.
              </p>
            </div>
            <div className="pt-4 border-t border-white/[0.08] flex items-center space-x-2 text-xs text-emerald-400 font-medium">
              <Check size={14} />
              <span>Row-Level Security & JWT</span>
            </div>
          </div>

          <div className="p-7 rounded-3xl bg-[#0e0920]/75 border border-white/10 hover:border-emerald-500/40 shadow-xl backdrop-blur-md flex flex-col justify-between transition-all duration-300">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-6">
                <CheckCircle2 size={24} />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Sıfır Veri Satışı & İzleyici</h3>
              <p className="text-xs sm:text-sm text-gray-300 leading-relaxed mb-6">
                Voys'ta sizi takip eden reklam kodları veya analiz izleyicileri bulunmaz. Profil bilgileriniz ve yazışmalarınız üçüncü taraf şirketlere asla satılmaz veya taranmaz.
              </p>
            </div>
            <div className="pt-4 border-t border-white/[0.08] flex items-center space-x-2 text-xs text-emerald-400 font-medium">
              <Check size={14} />
              <span>%100 İzleyicisiz ve Reklamsız</span>
            </div>
          </div>
        </div>

        {/* Security Trust Banner */}
        <div className="mt-8 p-5 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-sm flex flex-wrap items-center justify-around gap-4 text-xs sm:text-sm text-gray-300">
          <div className="flex items-center space-x-2">
            <Lock size={16} className="text-emerald-400" />
            <span>256-bit SSL / TLS Güvenli Bağlantı</span>
          </div>
          <div className="hidden sm:block text-gray-600">•</div>
          <div className="flex items-center space-x-2">
            <Shield size={16} className="text-emerald-400" />
            <span>Katı Gizlilik Standartları</span>
          </div>
          <div className="hidden sm:block text-gray-600">•</div>
          <div className="flex items-center space-x-2">
            <CheckCircle2 size={16} className="text-emerald-400" />
            <span>Sıfır Günlük / Sıfır Ses Kaydı</span>
          </div>
        </div>
      </section>

      {/* 5. Performans (#performance) */}
      <section id="performance" className="relative z-10 py-24 px-6 sm:px-10 lg:px-16 max-w-6xl mx-auto w-full scroll-mt-20">
        <div className="text-center mb-16">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-[#8B51FF]/15 border border-[#8B51FF]/30 text-[#d8b4fe] text-xs font-semibold uppercase tracking-wider mb-5">
            <Zap size={14} className="text-[#a36eff]" />
            <span>Performans & Hız</span>
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
            <div className="w-11 h-11 rounded-xl bg-[#8B51FF]/15 border border-[#8B51FF]/30 flex items-center justify-center text-[#c084fc] mb-4">
              <Cpu size={22} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Donanım Hızlandırmalı Medya Hattı</h3>
            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
              Voys masaüstü uygulaması, ekran yakalama ve ses filtreleme görevlerini modern GPU ve CPU komut setleriyle paralel işler. Rekabetçi oyunlarınızda mikro gecikmeler veya takılmalar yaşamazsınız.
            </p>
          </div>

          <div className="p-7 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-[#8B51FF]/40 transition-all backdrop-blur-sm">
            <div className="w-11 h-11 rounded-xl bg-[#8B51FF]/15 border border-[#8B51FF]/30 flex items-center justify-center text-[#c084fc] mb-4">
              <Zap size={22} />
            </div>
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
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-5">
            <HelpCircle size={14} className="text-indigo-400" />
            <span>Destek & Yardım</span>
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
          <div className="p-7 rounded-2xl bg-[#0e0920]/75 border border-white/10 hover:border-indigo-500/40 transition-all backdrop-blur-md">
            <div className="w-11 h-11 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4">
              <Users size={22} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Topluluk Kanalları</h3>
            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed mb-4">
              Voys sesli ve yazılı topluluk kanallarına katılarak diğer kullanıcılarla tanışın, deneyimlerinizi paylaşın ve anlık yardım alın.
            </p>
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-indigo-300">
              <span>Topluluğa Katıl</span>
              <ArrowRight size={13} />
            </div>
          </div>

          <div className="p-7 rounded-2xl bg-[#0e0920]/75 border border-white/10 hover:border-indigo-500/40 transition-all backdrop-blur-md">
            <div className="w-11 h-11 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4">
              <HelpCircle size={22} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Yardım & Rehberler</h3>
            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed mb-4">
              Mikrofon yapılandırması, yapay zeka gürültü filtresi kalibrasyonu ve ekran paylaşımı ayarlarını optimize etmek için detaylı kılavuzlar.
            </p>
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-indigo-300">
              <span>Rehberleri İncele</span>
              <ArrowRight size={13} />
            </div>
          </div>

          <div className="p-7 rounded-2xl bg-[#0e0920]/75 border border-white/10 hover:border-indigo-500/40 transition-all backdrop-blur-md">
            <div className="w-11 h-11 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4">
              <CheckCircle2 size={22} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Geri Bildirim & İletişim</h3>
            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed mb-4">
              Karşılaştığınız bir hatayı bildirmek veya yeni bir özellik önermek mi istiyorsunuz? Geri bildirimleriniz doğrudan geliştiricilere iletilir.
            </p>
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-indigo-300">
              <span>Hata veya Öneri Bildir</span>
              <ArrowRight size={13} />
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

      {/* 7. Bottom Final CTA & Footer */}
      <footer className="relative z-10 pt-16 pb-12 px-6 sm:px-10 lg:px-16 border-t border-white/[0.06] bg-[#07050f]/70 backdrop-blur-lg">
        <div className="max-w-6xl mx-auto flex flex-col items-center text-center">
          {/* Final CTA Box */}
          <div className="w-full max-w-3xl mb-16 p-8 sm:p-10 rounded-3xl bg-gradient-to-b from-[#180e3b] to-[#0c0820] border border-[#8B51FF]/30 shadow-2xl">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
              Voys Deneyimine Bugün Katılın
            </h2>
            <p className="text-sm text-gray-300 mb-8 max-w-lg mx-auto">
              Hemen ücretsiz indirin veya tarayıcınızdan saniyeler içinde arkadaşlarınızla iletişime geçin.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => handleDownloadClick(directExeUrl)}
                className="w-full sm:w-auto px-7 py-3 rounded-xl bg-white hover:bg-gray-100 text-gray-900 font-bold text-sm shadow-lg transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Download size={16} />
                <span>Windows için İndir</span>
              </button>
              <button
                type="button"
                onClick={() => navigate(isAuthenticated ? '/channel/home' : '/login')}
                className="w-full sm:w-auto px-7 py-3 rounded-xl bg-[#8B51FF] hover:bg-[#7a3ef2] text-white font-bold text-sm shadow-lg transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>Tarayıcıda Başlat</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>

          {/* Footer Bottom Details */}
          <div className="w-full flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-white/[0.06] text-xs text-gray-500 gap-4">
            <div className="flex items-center space-x-3">
              <img src="/voys_logo.png" alt="Voys" className="w-6 h-6 object-contain" />
              <span className="font-semibold text-gray-300">Voys</span>
              <span>•</span>
              <span>© 2026 Voys Inc. Tüm hakları saklıdır.</span>
            </div>

            <div className="flex items-center space-x-6">
              <a href="#discover" className="hover:text-gray-300 transition-colors">Keşfedin</a>
              <a href="#security" className="hover:text-gray-300 transition-colors">Güvenlik</a>
              <a href="#performance" className="hover:text-gray-300 transition-colors">Performans</a>
              <a href="#support" className="hover:text-gray-300 transition-colors">Destek</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
