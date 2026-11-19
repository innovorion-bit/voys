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
      className="w-full min-h-[4320px] text-gray-200 selection:bg-[#8B51FF]/40 selection:text-white font-sans antialiased overflow-x-hidden relative flex flex-col justify-between bg-[#07050f] scroll-smooth"
      style={{
        backgroundImage: "url('/voys_backgraund.jpg?v=6')",
        backgroundSize: '1920px 4320px',
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

      {/* 3. Keşfedin (#discover) */}
      <section id="discover" className="relative z-10 py-24 px-6 sm:px-10 lg:px-16 max-w-6xl mx-auto w-full text-center scroll-mt-20">
        <div className="text-center mb-16">
          <div className="inline-block px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-[#d8b4fe] text-xs font-semibold uppercase tracking-widest mb-5 backdrop-blur-sm">
            Keşfedin
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
            Modern ve Sade İletişim Deneyimi
          </h2>
          <p className="max-w-2xl mx-auto text-sm sm:text-base text-gray-300 font-normal leading-relaxed">
            Gereksiz karmaşıklıktan arındırılmış, doğrudan kristal netliğinde ses kalitesine, kesintisiz sohbetlere ve topluluğunuza odaklanan yeni nesil iletişim platformu.
          </p>
        </div>

        {/* 3 Key Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="p-7 rounded-3xl bg-[#0e0920]/75 border border-white/10 hover:border-[#8B51FF]/40 shadow-xl backdrop-blur-md flex flex-col justify-between transition-all duration-300">
            <div>
              <h3 className="text-xl font-bold text-white mb-3">Kristal Netliğinde Ses</h3>
              <p className="text-xs sm:text-sm text-gray-300 leading-relaxed mb-6">
                RNNoise yapay zeka gürültü engelleme teknolojisi ile mekanik klavye seslerini, oda yankısını ve arka plan gürültülerini tamamen yok edin.
              </p>
            </div>
            <div className="pt-4 border-t border-white/[0.08] text-xs text-[#d8b4fe] font-medium">
              RNNoise AI Filtreleme
            </div>
          </div>

          <div className="p-7 rounded-3xl bg-[#0e0920]/75 border border-white/10 hover:border-[#8B51FF]/40 shadow-xl backdrop-blur-md flex flex-col justify-between transition-all duration-300">
            <div>
              <h3 className="text-xl font-bold text-white mb-3">Grup ve Özel Odalar</h3>
              <p className="text-xs sm:text-sm text-gray-300 leading-relaxed mb-6">
                Arkadaşlarınızla bire bir doğrudan mesajlaşın veya dilediğiniz büyüklükte arkadaş grupları kurup sesli odalara tek tıklamayla anında katılın.
              </p>
            </div>
            <div className="pt-4 border-t border-white/[0.08] text-xs text-[#d8b4fe] font-medium">
              Sınırsız Katılımcı & Kanal
            </div>
          </div>

          <div className="p-7 rounded-3xl bg-[#0e0920]/75 border border-white/10 hover:border-[#8B51FF]/40 shadow-xl backdrop-blur-md flex flex-col justify-between transition-all duration-300">
            <div>
              <h3 className="text-xl font-bold text-white mb-3">60 FPS Ultra Akıcı Yayın</h3>
              <p className="text-xs sm:text-sm text-gray-300 leading-relaxed mb-6">
                Oyunlarınızı veya tüm masaüstünüzü 1080p 60 FPS hızında, sistem sesiyle birlikte donma ve takılma olmadan arkadaşlarınızla paylaşın.
              </p>
            </div>
            <div className="pt-4 border-t border-white/[0.08] text-xs text-[#d8b4fe] font-medium">
              1080p 60 FPS Donanım Hızlandırma
            </div>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
      </section>

      {/* 7. Genişletilmiş ve Esnek Footer */}
      <footer className="relative z-10 mt-auto pt-20 sm:pt-28 pb-12 sm:pb-16 px-6 sm:px-10 lg:px-16 border-t border-white/[0.08] bg-[#07050f]/85 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto w-full">
          {/* Üst Alan: Esnek Çok Kolonlu Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8 pb-16">
            {/* Marka & Durum (2 Kolon Genişliğinde) */}
            <div className="lg:col-span-2 flex flex-col justify-between pr-0 lg:pr-8">
              <div>
                <Link to="/" className="inline-block mb-4" title="Voys">
                  <img
                    src="/voys_weblogo.png"
                    alt="Voys"
                    className="h-7 sm:h-8 w-auto object-contain opacity-95 hover:opacity-100 transition-opacity"
                  />
                </Link>
                <p className="text-xs sm:text-sm text-gray-400 leading-relaxed max-w-sm mb-6">
                  Birlikte konuşmak, paylaşmak ve topluluk oluşturmak için tasarlanmış yeni nesil yüksek performanslı iletişim platformu.
                </p>
              </div>

              {/* Sistem Durumu Rozeti */}
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Tüm Sistemler Operasyonel</span>
                </div>
                <div className="text-xs text-gray-500 font-mono">v1.0.0</div>
              </div>
            </div>

            {/* Kolon 1: Gezinme / Ürün */}
            <div className="flex flex-col space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-white">
                Ürün
              </div>
              <a href="#discover" className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors duration-150">
                Keşfedin
              </a>
              <a href="#security" className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors duration-150">
                Güvenlik
              </a>
              <a href="#performance" className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors duration-150">
                Performans
              </a>
              <a href="#support" className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors duration-150">
                Destek
              </a>
              <Link to="/auth" className="text-xs sm:text-sm text-purple-400 hover:text-purple-300 transition-colors duration-150">
                Web İstemcisi →
              </Link>
            </div>

            {/* Kolon 2: Platform & İndir */}
            <div className="flex flex-col space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-white">
                Platform
              </div>
              <button
                type="button"
                onClick={() => handleDownloadClick(directExeUrl)}
                className="text-left text-xs sm:text-sm text-gray-400 hover:text-white transition-colors duration-150"
              >
                Windows (x64) İndir
              </button>
              <Link to="/auth" className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors duration-150">
                Tarayıcıda Çalıştır
              </Link>
              <a href="#performance" className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors duration-150">
                Sistem Gereksinimleri
              </a>
              <a href="#discover" className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors duration-150">
                Ekran Yayını Özellikleri
              </a>
            </div>

            {/* Kolon 3: Kurumsal & Yasal */}
            <div className="flex flex-col space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-white">
                Kurumsal & Yasal
              </div>
              <a href="#security" className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors duration-150">
                Gizlilik İlkeleri
              </a>
              <a href="#security" className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors duration-150">
                Uçtan Uca Şifreleme
              </a>
              <a href="#support" className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors duration-150">
                Topluluk Kuralları
              </a>
              <a href="#support" className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors duration-150">
                Hata Bildirimi
              </a>
            </div>
          </div>

          {/* Alt Esnek Şerit: Güven & Temel Değerler */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex flex-wrap items-center justify-between gap-4 text-xs text-gray-400 mb-10">
            <div className="flex flex-wrap items-center gap-6 text-xs text-gray-300">
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                Eşler Arası (P2P) WebRTC
              </span>
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                Sıfır Günlük & Mutlak Gizlilik
              </span>
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                RNNoise Yapay Zeka Filtresi
              </span>
            </div>

            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 ml-auto sm:ml-0"
            >
              <span>Başa Dön</span>
              <span>↑</span>
            </button>
          </div>

          {/* En Alt Bar: Telif ve Haklar */}
          <div className="pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-4">
            <div className="flex items-center space-x-2">
              <span>© 2026 Voys Inc. Tüm hakları saklıdır.</span>
            </div>

            <div className="text-xs text-gray-500">
              Topluluklar ve oyuncular için tasarlandı.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
