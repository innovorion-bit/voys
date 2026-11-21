import React from 'react';
import { RefreshCw, Trash2, Copy, Check } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, copied: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Voys ErrorBoundary caught:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetCache = () => {
    try {
      // Clear non-critical caches and local storage states
      const keys = Object.keys(localStorage);
      keys.forEach((k) => {
        if (!k.includes('auth') && !k.includes('token') && !k.includes('supabase.auth')) {
          localStorage.removeItem(k);
        }
      });
      sessionStorage.clear();
    } catch {}
    window.location.reload();
  };

  handleCopyError = () => {
    const errorMsg = this.state.error?.stack || this.state.error?.message || String(this.state.error);
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(errorMsg).then(() => {
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2000);
      }).catch(() => {});
    }
  };

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || this.state.error?.toString() || 'Bilinmeyen arayüz hatası.';
      const errorStack = this.state.error?.stack || '';

      return (
        <div className="min-h-screen w-screen bg-[#08080a] text-gray-200 flex flex-col items-center justify-center p-6 select-none font-sans">
          <div className="max-w-lg w-full bg-[#0c0c0e] border border-white/10 rounded-3xl p-7 text-center shadow-2xl">
            <h1 className="text-base font-bold text-white tracking-wide mb-2">
              Bir Arayüz Hatası Oluştu
            </h1>
            <p className="text-xs text-gray-400 mb-4 leading-relaxed">
              Voys arayüzü yüklenirken beklenmeyen bir durum meydana geldi.
            </p>

            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3.5 mb-5 text-left">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase font-bold text-red-400 tracking-wider">Hata Detayı</span>
                  <button
                    type="button"
                    onClick={this.handleCopyError}
                    className="text-[10px] text-gray-400 hover:text-white flex items-center space-x-1 transition cursor-pointer"
                    title="Hatayı panoya kopyala"
                  >
                    {this.state.copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    <span>{this.state.copied ? 'Kopyalandı' : 'Kopyala'}</span>
                  </button>
                </div>
                <p className="text-[11px] font-mono text-red-300 break-words font-medium">
                  {errorMsg}
                </p>
                {errorStack && (
                  <pre className="text-[9px] font-mono text-gray-400 mt-2 max-h-24 overflow-auto whitespace-pre-wrap select-all bg-black/30 p-2 rounded-lg border border-white/5">
                    {errorStack.slice(0, 500)}
                  </pre>
                )}
              </div>
            )}

            <div className="flex items-center justify-center gap-2.5 text-xs">
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2 bg-[#8B51FF] hover:bg-[#773BF5] text-white font-semibold rounded-xl flex items-center space-x-1.5 transition shadow-sm active:scale-95 cursor-pointer"
              >
                <RefreshCw size={13} />
                <span>Yeniden Dene</span>
              </button>
              <button
                type="button"
                onClick={this.handleResetCache}
                className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white font-medium rounded-xl flex items-center space-x-1.5 transition border border-white/10 active:scale-95 cursor-pointer"
                title="Yerel önbellekleri temizler ve sayfayı yeniler"
              >
                <Trash2 size={13} className="text-gray-400" />
                <span>Önbelleği Temizle</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
