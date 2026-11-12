import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Lock,
  Mail,
  User,
  ShieldCheck,
  ArrowRight,
  Eye,
  EyeOff,
  Minus,
  X,
  KeyRound,
  CheckCircle2,
  ArrowLeft,
  Sparkles,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { resizeToAuthWindow, resizeToMainWindow, minimizeWindow, closeWindow } from '../utils/windowManager';

export const AuthPage = ({ initialMode = 'login' }) => {
  const [mode, setMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      if (hash.includes('type=recovery') || search.includes('type=recovery')) {
        return 'reset';
      }
    }
    return initialMode;
  }); // 'login' | 'register' | 'forgot' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [emailConfirmationRequired, setEmailConfirmationRequired] = useState(false);
  const [slowNotice, setSlowNotice] = useState(false);

  const {
    login,
    register,
    resetPassword,
    updatePassword,
    isAuthenticated,
    isPasswordRecovery,
  } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/channel/home';

  // If recovery event fires while on page
  useEffect(() => {
    if (isPasswordRecovery) {
      setMode('reset');
    }
  }, [isPasswordRecovery]);

  // Window sizing & auth redirect
  useEffect(() => {
    if (isAuthenticated && mode !== 'reset') {
      resizeToMainWindow();
      navigate(from, { replace: true });
    } else {
      resizeToAuthWindow(mode);
    }
  }, [isAuthenticated, mode, from, navigate]);

  useEffect(() => {
    let t;
    if (isSubmitting) {
      t = setTimeout(() => {
        setSlowNotice(true);
      }, 3000);
    } else {
      setSlowNotice(false);
    }
    return () => clearTimeout(t);
  }, [isSubmitting]);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setErrorMsg('');
    setSuccessMsg('');
    setEmailConfirmationRequired(false);

    // 1. FORGOT PASSWORD MODE
    if (mode === 'forgot') {
      const cleanEmail = email.trim();
      if (!cleanEmail) {
        setErrorMsg('Lütfen kayıtlı e-posta adresinizi girin.');
        return;
      }
      setIsSubmitting(true);
      const res = await resetPassword(cleanEmail);
      setIsSubmitting(false);

      if (res.success) {
        setSuccessMsg('Şifre sıfırlama bağlantısı e-posta adresinize gönderildi. Lütfen gelen kutunuzu kontrol edin.');
      } else {
        setErrorMsg(res.error?.message || 'Şifre sıfırlama e-postası gönderilemedi.');
      }
      return;
    }

    // 2. RESET / UPDATE PASSWORD MODE
    if (mode === 'reset') {
      if (!password || password.length < 6) {
        setErrorMsg('Yeni şifreniz en az 6 karakter olmalıdır.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Şifreler birbiriyle uyuşmuyor.');
        return;
      }

      setIsSubmitting(true);
      const res = await updatePassword(password);
      setIsSubmitting(false);

      if (res.success) {
        await resizeToMainWindow();
        navigate(from, { replace: true });
      } else {
        setErrorMsg(res.error?.message || 'Şifre güncellenemedi.');
      }
      return;
    }

    // 3. REGISTER MODE
    if (mode === 'register') {
      if (!username.trim()) {
        setErrorMsg('Lütfen bir kullanıcı adı girin.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Şifreler birbiriyle uyuşmuyor.');
        return;
      }
      if (password.length < 6) {
        setErrorMsg('Şifre en az 6 karakter olmalıdır.');
        return;
      }

      setIsSubmitting(true);
      const res = await register(
        email.trim(),
        password,
        username.trim(),
        displayName.trim() || username.trim()
      );
      setIsSubmitting(false);

      if (res.success) {
        if (res.needsEmailConfirmation) {
          setEmailConfirmationRequired(true);
          setSuccessMsg('Kayıt başarılı! Lütfen hesabınızı doğrulamak için e-postanıza gönderilen bağlantıya tıklayın.');
        } else {
          await resizeToMainWindow();
          navigate(from, { replace: true });
        }
      } else {
        const msg = res.error?.message || 'Kayıt işlemi başarısız.';
        setErrorMsg(msg);
      }
      return;
    }

    // 4. LOGIN MODE
    setIsSubmitting(true);
    const res = await login(email.trim(), password);
    setIsSubmitting(false);

    if (res.success) {
      await resizeToMainWindow();
      navigate(from, { replace: true });
    } else {
      const msg = res.error?.message || 'Giriş yapılamadı.';
      setErrorMsg(msg);
    }
  };

  return (
    <div
      data-tauri-drag-region
      className="h-screen w-screen bg-[#0c0c0e] border border-white/10 rounded-2xl shadow-2xl flex flex-col justify-between overflow-hidden relative select-none"
    >
      {/* Window Controls (Minimize & Close) on top-right of the window */}
      <div 
        data-tauri-drag-region="false"
        className="absolute right-2.5 top-2.5 flex items-center space-x-1 z-30"
      >
        <button
          type="button"
          onClick={minimizeWindow}
          className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
          title="Simge Durumuna Küçült"
        >
          <Minus size={13} />
        </button>
        <button
          type="button"
          onClick={closeWindow}
          className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-rose-500 rounded-lg transition cursor-pointer"
          title="Kapat"
        >
          <X size={13} />
        </button>
      </div>

      {/* Header Banner */}
      <div
        data-tauri-drag-region
        className="pt-6 pb-1 text-center relative cursor-default flex-shrink-0"
      >
        <div className="flex justify-center">
          {mode === 'reset' ? (
            <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <KeyRound size={18} className="text-indigo-400" />
            </div>
          ) : mode === 'forgot' ? (
            <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Mail size={18} className="text-indigo-400" />
            </div>
          ) : (
            <img
              src="/voys_logo.png"
              alt="Voys"
              draggable={false}
              className="w-8 h-8 object-contain select-none pointer-events-none"
            />
          )}
        </div>
        {(mode === 'forgot' || mode === 'reset') && (
          <div className="mt-2 px-4">
            <h1 className="text-xs font-bold text-white tracking-wider uppercase">
              {mode === 'forgot' && 'Şifremi Sıfırla'}
              {mode === 'reset' && 'Yeni Şifre Belirle'}
            </h1>
            <p className="text-[10.5px] text-gray-400 mt-0.5">
              {mode === 'forgot' && 'E-posta adresinize sıfırlama linki göndereceğiz'}
              {mode === 'reset' && 'Hesabınız için güçlü bir şifre belirleyin'}
            </p>
          </div>
        )}
      </div>

      {/* Form Content */}
      <div className="flex-1 p-3.5 flex flex-col justify-between overflow-y-auto custom-scrollbar">
          {/* Error Message Alert */}
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl space-y-2 animate-in fade-in">
              <div className="leading-relaxed flex items-start space-x-2">
                <span className="flex-1">{errorMsg}</span>
              </div>
              {errorMsg.includes('bağlanılamadı') && (
                <div className="pt-2 border-t border-rose-500/20 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="inline-flex items-center space-x-1.5 px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded-lg text-[11px] font-semibold transition active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw size={11} className={isSubmitting ? 'animate-spin' : ''} />
                    <span>Tekrar Dene</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Success Message Alert */}
          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-start space-x-2 animate-in fade-in">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" />
              <div className="leading-relaxed">{successMsg}</div>
            </div>
          )}

          {emailConfirmationRequired ? (
            <div className="pt-2 text-center space-y-3">
              <p className="text-xs text-gray-300">
                E-postanızı onayladıktan sonra hemen giriş yapabilirsiniz.
              </p>
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setEmailConfirmationRequired(false);
                  setSuccessMsg('');
                }}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition"
              >
                Giriş Ekranına Dön
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className={`space-y-2.5 ${mode === 'login' ? 'pt-4' : ''}`}>
              {/* Register: Username & Display Name */}
              {mode === 'register' && (
                <>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                      Kullanıcı Adı
                    </label>
                    <div className="relative flex items-center">
                      <User size={15} className="absolute left-3.5 text-gray-500 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2 bg-[#141418] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                      Görünen İsim (İsteğe Bağlı)
                    </label>
                    <div className="relative flex items-center">
                      <Sparkles size={15} className="absolute left-3.5 text-gray-500 pointer-events-none" />
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2 bg-[#141418] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Email Input (Login, Register, Forgot Password) */}
              {mode !== 'reset' && (
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                    E-Posta Adresi
                  </label>
                  <div className="relative flex items-center">
                    <Mail size={15} className="absolute left-3.5 text-gray-500 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2 bg-[#141418] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
                    />
                  </div>
                </div>
              )}

              {/* Password Input (Login, Register, Reset) */}
              {mode !== 'forgot' && (
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                      {mode === 'reset' ? 'Yeni Şifre' : 'Şifre'}
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('forgot');
                          setErrorMsg('');
                          setSuccessMsg('');
                          resizeToAuthWindow('forgot');
                        }}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 transition cursor-pointer"
                      >
                        Şifremi Unuttum?
                      </button>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <Lock size={15} className="absolute left-3.5 text-gray-500 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2 bg-[#141418] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 text-gray-500 hover:text-gray-300 transition"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              )}

              {/* Confirm Password (Register and Reset mode) */}
              {(mode === 'register' || mode === 'reset') && (
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                    Şifreyi Doğrula
                  </label>
                  <div className="relative flex items-center">
                    <Lock size={15} className="absolute left-3.5 text-gray-500 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2 bg-[#141418] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
                    />
                  </div>
                </div>
              )}

              {/* Remember Me Checkbox */}
              {mode === 'login' && (
                <div className="flex items-center space-x-2 pt-0.5">
                  <input
                    type="checkbox"
                    id="remember"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded bg-[#141418] border-white/10 text-indigo-500 focus:ring-0 cursor-pointer accent-indigo-500"
                  />
                  <label htmlFor="remember" className="text-xs text-gray-300 cursor-pointer select-none">
                    Beni bu cihazda hatırla
                  </label>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-1.5 py-2 px-4 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-600/25 transition duration-150 active:scale-95 disabled:opacity-60 flex items-center justify-center space-x-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center space-x-2">
                    <Loader2 size={14} className="animate-spin" />
                    <span>
                      {mode === 'login' ? 'Giriş Yapılıyor...' : 'İşlem Yapılıyor...'}
                    </span>
                  </span>
                ) : (
                  <>
                    <span>
                      {mode === 'login'
                        ? 'Giriş Yap'
                        : mode === 'register'
                        ? 'Kayıt Ol'
                        : mode === 'forgot'
                        ? 'Sıfırlama Bağlantısı Gönder'
                        : 'Yeni Şifreyi Kaydet'}
                    </span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
              {slowNotice && isSubmitting && (
                <p className="text-[10px] text-indigo-300/80 text-center animate-pulse pt-1">
                  Sunucu yanıtı bekleniyor, lütfen bekleyin...
                </p>
              )}
            </form>
          )}

          {/* Mode Switchers / Footer Links */}
          <div className="text-center pt-2 border-t border-white/5 text-xs text-gray-400">
            {mode === 'login' && (
              <div className="space-y-2">
                <div>
                  Henüz bir hesabınız yok mu?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setErrorMsg('');
                      setSuccessMsg('');
                      resizeToAuthWindow('register');
                    }}
                    className="text-indigo-400 hover:text-indigo-300 font-semibold ml-1 cursor-pointer"
                  >
                    Ücretsiz Kayıt Ol
                  </button>
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div>
                Zaten bir hesabınız var mı?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg('');
                    setSuccessMsg('');
                    resizeToAuthWindow('login');
                  }}
                  className="text-indigo-400 hover:text-indigo-300 font-semibold ml-1 cursor-pointer"
                >
                  Giriş Yap
                </button>
              </div>
            )}

            {(mode === 'forgot' || mode === 'reset') && (
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg('');
                    setSuccessMsg('');
                    resizeToAuthWindow('login');
                  }}
                  className="text-indigo-400 hover:text-indigo-300 inline-flex items-center space-x-1 cursor-pointer"
                >
                  <ArrowLeft size={12} />
                  <span>Giriş ekranına dön</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
  );
};
