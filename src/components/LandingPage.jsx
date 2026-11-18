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
            backgroundImage: "url('/voys_hero_bg.jpg')",
            backgroundSize: '100% 100%',
            backgroundRepeat: 'no-repeat',
            transform: 'translate3d(-50%, 0px, 0)',
          }}
        />
        {/* Subtle ambient lighting vignette overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#07050f]/60 pointer-events-none" />
      </div>
      {/* 1. Header / Navbar */}
      <header className="sticky top-0 z-50 bg-[#07050f]/60 backdrop-blur-md pt-4 sm:pt-6 pb-3 border-b border-white/[0.04]">
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

          {/* Nav Links - Yeni Menüler (True Center with Purple Button Hover Animation) */}
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
              href="#features"
              className="px-3.5 py-1.5 rounded-xl text-gray-200 hover:text-white hover:bg-[#8B51FF] hover:shadow-lg hover:shadow-[#8B51FF]/30 transition-all duration-200 ease-out"
            >
              Özellikler
            </a>
            <a
              href="#support"
              className="px-3.5 py-1.5 rounded-xl text-gray-200 hover:text-white hover:bg-[#8B51FF] hover:shadow-lg hover:shadow-[#8B51FF]/30 transition-all duration-200 ease-out"
            >
              Destek
            </a>
            <a
              href="#developers"
              className="px-3.5 py-1.5 rounded-xl text-gray-200 hover:text-white hover:bg-[#8B51FF] hover:shadow-lg hover:shadow-[#8B51FF]/30 transition-all duration-200 ease-out"
            >
              Geliştiriciler
            </a>
            <a
              href="#performance"
              className="px-3.5 py-1.5 rounded-xl text-gray-200 hover:text-white hover:bg-[#8B51FF] hover:shadow-lg hover:shadow-[#8B51FF]/30 transition-all duration-200 ease-out"
            >
              Performans
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
      <section id="discover" className="relative z-10 py-24 px-6 sm:px-10 lg:px-16 max-w-6xl mx-auto w-full text-center">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-[#8B51FF]/15 border border-[#8B51FF]/30 text-[#d8b4fe] text-xs font-semibold uppercase tracking-wider mb-5">
          <Sparkles size={14} className="text-[#a36eff]" />
          <span>Keşfedin</span>
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
          Modern ve Sade İletişim Deneyimi
        </h2>
        <p className="max-w-2xl mx-auto text-sm sm:text-base text-gray-300 font-normal leading-relaxed mb-12">
          Gereksiz karmaşıklıktan arındırılmış, doğrudan ses kalitesine ve topluluğunuza odaklanan yeni nesil arayüz.
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
          <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-[#8B51FF]/40 transition-colors backdrop-blur-sm">
            <div className="w-10 h-10 rounded-xl bg-[#8B51FF]/15 border border-[#8B51FF]/30 flex items-center justify-center text-[#c084fc] mb-4">
              <Headphones size={20} />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Kristal Netliğinde Ses</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Yapay zeka gürültü filtreleme teknolojisi ile mekanik klavye seslerini ve arka plan gürültülerini yok edin.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-[#8B51FF]/40 transition-colors backdrop-blur-sm">
            <div className="w-10 h-10 rounded-xl bg-[#8B51FF]/15 border border-[#8B51FF]/30 flex items-center justify-center text-[#c084fc] mb-4">
              <Monitor size={20} />
            </div>
            <h3 className="text-base font-bold text-white mb-2">60 FPS Ultra Akıcı Yayın</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Oyunlarınızı veya masaüstünüzü 1080p 60 FPS hızında arkadaşlarınızla donma olmadan paylaşın.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-[#8B51FF]/40 transition-colors backdrop-blur-sm">
            <div className="w-10 h-10 rounded-xl bg-[#8B51FF]/15 border border-[#8B51FF]/30 flex items-center justify-center text-[#c084fc] mb-4">
              <Zap size={20} />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Ultra Düşük Gecikme</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Optimize edilmiş WebRTC doğrudan eşler arası bağlantı altyapısıyla 25ms'nin altında anlık iletişim.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Özellikler (#features) */}
      <section id="features" className="relative z-10 py-24 px-6 sm:px-10 lg:px-16 max-w-6xl mx-auto w-full">
        <div className="text-center mb-16">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-[#8B51FF]/15 border border-[#8B51FF]/30 text-[#d8b4fe] text-xs font-semibold uppercase tracking-wider mb-5">
            <Radio size={14} className="text-[#a36eff]" />
            <span>Özellikler</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
            İhtiyacınız Olan Her Şey Bir Arada
          </h2>
          <p className="max-w-2xl mx-auto text-sm sm:text-base text-gray-300 font-normal leading-relaxed">
            Hem sıkı oyuncular hem de üretken ekipler için tasarlanan gelişmiş iletişim araçları.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-7 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-[#8B51FF]/50 hover:bg-white/[0.05] transition-all duration-300 backdrop-blur-sm">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-5">
              <Headphones size={24} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2.5">RNNoise Yapay Zeka Filtresi</h3>
            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
              Sinir ağları ile eğitilmiş gürültü filtreleme modeli klavye vuruşlarını, vantilatör uğultusunu ve çevresel gürültüyü sesinizden otomatik olarak ayrıştırır.
            </p>
          </div>

          <div className="p-7 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-[#8B51FF]/50 hover:bg-white/[0.05] transition-all duration-300 backdrop-blur-sm">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-5">
              <Users size={24} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2.5">Grup ve Özel Sohbet Odaları</h3>
            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
              Arkadaşlarınızla bire bir doğrudan mesajlaşın veya dilediğiniz büyüklükte grup sohbetleri kurun. Sesli odalara tek tıklamayla anında katılın.
            </p>
          </div>

          <div className="p-7 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-[#8B51FF]/50 hover:bg-white/[0.05] transition-all duration-300 backdrop-blur-sm">
            <div className="w-12 h-12 rounded-2xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400 mb-5">
              <Monitor size={24} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2.5">Pencere ve Ekran Yayını</h3>
            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
              İster sadece oyun pencerenizi, ister tüm ekranınızı paylaşın. Sistem sesi paylaşımı ve ayarlanabilir çözünürlük seçenekleri parmaklarınızın ucunda.
            </p>
          </div>

          <div className="p-7 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-[#8B51FF]/50 hover:bg-white/[0.05] transition-all duration-300 backdrop-blur-sm">
            <div className="w-12 h-12 rounded-2xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400 mb-5">
              <Sparkles size={24} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2.5">Özelleştirilebilir Profil & Durum</h3>
            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
              Özel profil fotoğrafları, biyografi, durum rozetleri ve oynadığınız oyunu gösteren zengin durum bilgisiyle profilinizi kendinize göre şekillendirin.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Güvenlik (#security) & Performans (#performance) */}
      <section className="relative z-10 py-24 px-6 sm:px-10 lg:px-16 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Güvenlik Kartı */}
          <div id="security" className="p-8 rounded-3xl bg-[#0e0920]/70 border border-white/10 shadow-xl backdrop-blur-md flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-6">
                <Shield size={24} />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Tavizsiz Veri Güvenliği</h3>
              <p className="text-sm text-gray-300 leading-relaxed mb-6">
                Kişisel verileriniz ve iletişim geçmişiniz en üst düzey endüstri standartlarında şifrelenir. Verileriniz asla üçüncü şahıslarla paylaşılmaz veya reklam amaçlı taranmaz.
              </p>
              <ul className="space-y-3 text-xs sm:text-sm text-gray-300">
                <li className="flex items-center space-x-2.5">
                  <Check size={16} className="text-emerald-400 flex-shrink-0" />
                  <span>Şifreli P2P doğrudan ses ve veri akışı</span>
                </li>
                <li className="flex items-center space-x-2.5">
                  <Check size={16} className="text-emerald-400 flex-shrink-0" />
                  <span>Supabase güvenli kurumsal kimlik doğrulama</span>
                </li>
                <li className="flex items-center space-x-2.5">
                  <Check size={16} className="text-emerald-400 flex-shrink-0" />
                  <span>Sıfır veri satışı ve gizlilik odaklı altyapı</span>
                </li>
              </ul>
            </div>
            <div className="pt-6 mt-6 border-t border-white/[0.08] flex items-center justify-between text-xs text-gray-400">
              <span className="flex items-center space-x-1.5">
                <Lock size={13} className="text-emerald-400" />
                <span>256-bit SSL / TLS Şifreleme</span>
              </span>
              <span className="text-emerald-400 font-semibold">%100 Güvenli</span>
            </div>
          </div>

          {/* Performans Kartı */}
          <div id="performance" className="p-8 rounded-3xl bg-[#0e0920]/70 border border-white/10 shadow-xl backdrop-blur-md flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-[#8B51FF]/15 border border-[#8B51FF]/30 flex items-center justify-center text-[#c084fc] mb-6">
                <Zap size={24} />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Üst Düzey Donanım Verimliliği</h3>
              <p className="text-sm text-gray-300 leading-relaxed mb-6">
                Voys, arka planda çalışırken oyun performansınızdan ödün vermemeniz için minimum bellek (RAM) ve işlemci kaynağı tüketecek şekilde optimize edilmiştir.
              </p>
              <ul className="space-y-3 text-xs sm:text-sm text-gray-300">
                <li className="flex items-center space-x-2.5">
                  <Check size={16} className="text-[#a36eff] flex-shrink-0" />
                  <span>25ms altı ultra düşük ses gecikmesi</span>
                </li>
                <li className="flex items-center space-x-2.5">
                  <Check size={16} className="text-[#a36eff] flex-shrink-0" />
                  <span>Minimum RAM tüketimi ve sıfır FPS kaybı</span>
                </li>
                <li className="flex items-center space-x-2.5">
                  <Check size={16} className="text-[#a36eff] flex-shrink-0" />
                  <span>Yüksek kaliteli 48kHz Opus ses kodeği</span>
                </li>
              </ul>
            </div>
            <div className="pt-6 mt-6 border-t border-white/[0.08] flex items-center justify-between text-xs text-gray-400">
              <span className="flex items-center space-x-1.5">
                <Cpu size={13} className="text-[#a36eff]" />
                <span>WebRTC Donanım Hızlandırması</span>
              </span>
              <span className="text-[#c084fc] font-semibold">60 FPS Akıcılık</span>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Geliştiriciler (#developers) & Destek (#support) */}
      <section className="relative z-10 py-20 px-6 sm:px-10 lg:px-16 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Geliştiriciler */}
          <div id="developers" className="p-7 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4">
              <Code2 size={20} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Geliştiriciler İçin</h3>
            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed mb-4">
              Açık standartlar, modern API mimarisi ve topluluk botları için hazır altyapı ile kendi deneyimlerinizi Voys ekosistemine entegre edin.
            </p>
            <div className="flex items-center space-x-2 text-xs font-semibold text-[#c084fc]">
              <span>API ve SDK belgeleri yakında</span>
              <ArrowRight size={13} />
            </div>
          </div>

          {/* Destek */}
          <div id="support" className="p-7 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4">
              <HelpCircle size={20} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">7/24 Kesintisiz Destek</h3>
            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed mb-4">
              Sorularınız, teknik sorunlarınız veya geri bildirimleriniz için yardım merkezi ve topluluk kanallarımız her zaman yanınızda.
            </p>
            <div className="flex items-center space-x-2 text-xs font-semibold text-indigo-300">
              <span>Topluluk rehberleri ve yardım merkezi</span>
              <ArrowRight size={13} />
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
              <a href="#features" className="hover:text-gray-300 transition-colors">Özellikler</a>
              <a href="#security" className="hover:text-gray-300 transition-colors">Güvenlik</a>
              <a href="#performance" className="hover:text-gray-300 transition-colors">Performans</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
