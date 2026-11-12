import React from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Stand.upp ErrorBoundary caught:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    try {
      localStorage.removeItem('standupp_local_session');
      localStorage.removeItem('standupp_user_profile');
      window.location.href = '/login';
    } catch {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-screen bg-[#08080a] text-gray-200 flex flex-col items-center justify-center p-6 select-none font-sans">
          <div className="max-w-md w-full bg-[#0c0c0e] border border-white/10 rounded-3xl p-6 text-center shadow-xl">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shadow-inner">
              <AlertTriangle size={28} />
            </div>

            <h1 className="text-base font-bold text-white tracking-wide mb-2">
              Bir Arayüz Hatası Oluştu
            </h1>
            <p className="text-xs text-gray-400 mb-4 leading-relaxed">
              Voys arayüzü yüklenirken beklenmeyen bir durum meydana geldi.
            </p>

            {this.state.error?.message && (
              <div className="bg-[#141418] p-3.5 rounded-xl border border-white/10 text-left text-[11px] text-rose-300 font-mono break-all mb-5 max-h-32 overflow-y-auto">
                {this.state.error.message}
              </div>
            )}

            <div className="flex items-center justify-center space-x-3 text-xs">
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl flex items-center space-x-2 transition"
              >
                <RefreshCw size={14} />
                <span>Yeniden Dene</span>
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white font-semibold rounded-xl flex items-center space-x-2 border border-white/10 transition active:scale-95"
              >
                <Trash2 size={14} />
                <span>Oturumu Sıfırla</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
