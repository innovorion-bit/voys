import React from 'react';
import { RefreshCw } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
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

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-screen bg-[#08080a] text-gray-200 flex flex-col items-center justify-center p-6 select-none font-sans">
          <div className="max-w-md w-full bg-[#0c0c0e] border border-white/10 rounded-3xl p-7 text-center shadow-2xl">
            <h1 className="text-base font-bold text-white tracking-wide mb-2">
              Bir Arayüz Hatası Oluştu
            </h1>
            <p className="text-xs text-gray-400 mb-6 leading-relaxed">
              Voys arayüzü yüklenirken beklenmeyen bir durum meydana geldi.
            </p>

            <div className="flex items-center justify-center text-xs">
              <button
                type="button"
                onClick={this.handleReload}
                className="px-5 py-2.5 bg-[#8B51FF] hover:bg-[#773BF5] text-white font-semibold rounded-xl flex items-center space-x-2 transition shadow-sm active:scale-95 cursor-pointer"
              >
                <RefreshCw size={14} />
                <span>Yeniden Dene</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
