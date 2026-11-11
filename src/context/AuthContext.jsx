import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { AuthContext } from './authContextDef';
import { supabase, dbService, localDb, isSupabaseConfigured, ADMIN_USER_ID, ADMIN_EMAIL } from '../lib/supabase';
import { chatService } from '../services/chatService';
import { resizeToMainWindow, resizeToLoginWindow } from '../utils/windowManager';

function getAuthErrorMessage(error) {
  if (!error) return 'Bir hata oluştu.';
  const msg = error.message || String(error);
  if (msg.includes('Invalid login credentials')) {
    return 'E-posta veya şifre hatalı. Lütfen bilgilerinizi kontrol edin.';
  }
  if (msg.includes('Email not confirmed')) {
    return 'E-posta adresiniz henüz onaylanmamış. Lütfen gelen kutunuzu kontrol edin.';
  }
  if (msg.includes('User already registered')) {
    return 'Bu e-posta adresi ile zaten bir hesap oluşturulmuş.';
  }
  if (msg.includes('Password should be at least')) {
    return 'Şifreniz en az 6 karakter uzunluğunda olmalıdır.';
  }
  if (msg.includes('rate limit') || msg.includes('Too many requests')) {
    return 'Çok fazla deneme yapıldı. Lütfen biraz bekleyip tekrar deneyin.';
  }
  if (error.isNetworkOrTimeout || msg.includes('Failed to fetch') || msg.includes('Zaman aşımı') || msg.includes('bağlanılamadı') || msg.includes('504') || msg.includes('Gateway')) {
    return 'Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.';
  }
  return msg;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const isMountedRef = useRef(true);

  // Helper to construct a normalized user object
  const buildNormalizedUser = useCallback((rawUser, profileData = null) => {
    if (!rawUser) return null;
    const emailPrefix = rawUser.email ? rawUser.email.split('@')[0] : 'kullanici';
    const rawUsername =
      profileData?.username ||
      rawUser.user_metadata?.username ||
      rawUser.username ||
      emailPrefix.replace(/[^a-z0-9_]/g, '') ||
      'user';
    const rawDisplayName =
      profileData?.display_name ||
      rawUser.user_metadata?.display_name ||
      rawUser.user_metadata?.name ||
      profileData?.name ||
      rawUsername;
    const rawAvatar =
      profileData?.avatar_url ||
      profileData?.avatar ||
      rawUser.user_metadata?.avatar_url ||
      rawUser.avatar_url ||
      rawUser.avatar ||
      '';

    return {
      ...rawUser,
      ...(profileData || {}),
      app_metadata: rawUser.app_metadata || profileData?.app_metadata || null,
      id: rawUser.id,
      email: rawUser.email || profileData?.email,
      username: rawUsername,
      display_name: rawDisplayName,
      name: rawDisplayName,
      avatar: rawAvatar,
      avatar_url: rawAvatar,
    };
  }, []);

  // Initialize auth session and live listener
  useEffect(() => {
    isMountedRef.current = true;
    let unsubProfiles = null;

    // Fast-path: get current session immediately without waiting for events
    const initSession = async () => {
      try {
        const { data } = await dbService.getSession();
        if (!isMountedRef.current) return;
        const currentSession = data?.session || null;
        if (currentSession?.user) {
          setSession(currentSession);
          setUser(buildNormalizedUser(currentSession.user));
          setLoading(false);
          resizeToMainWindow();

          // Upgrade JWT claims once if admin role was added server-side to an active session
          if (
            currentSession.user.id === ADMIN_USER_ID &&
            String(currentSession.user.email || '').toLowerCase() === ADMIN_EMAIL &&
            currentSession.user.app_metadata?.role !== 'admin' &&
            supabase?.auth?.refreshSession
          ) {
            supabase.auth.refreshSession().catch(() => {});
          }

          // Fetch fresh profile in background
          dbService.ensureProfile(currentSession.user)
            .then((profileData) => {
              if (isMountedRef.current && profileData) {
                setUser((prev) => (prev ? buildNormalizedUser(prev, profileData) : prev));
              }
            })
            .catch(() => {});
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.warn('initSession error:', err);
        if (isMountedRef.current) setLoading(false);
      }
    };

    initSession();

    // Safety timeout: ensure loading never hangs indefinitely
    const safetyTimer = setTimeout(() => {
      if (isMountedRef.current) {
        setLoading((prev) => (prev ? false : prev));
      }
    }, 2500);

    // Subscribe to auth state changes
    const { data: { subscription } } = dbService.onAuthStateChange(async (event, currentSession) => {
      if (!isMountedRef.current) return;
      setSession(currentSession);
      const currentUser = currentSession?.user || null;

      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        toast.info('Şifre Sıfırlama', {
          description: 'Lütfen yeni şifrenizi belirleyin.',
        });
      }

      if (currentUser) {
        // Set immediate user state to ensure instant UI responsiveness
        setUser((prev) => buildNormalizedUser(currentUser, prev));
        setLoading(false);
        resizeToMainWindow();

        // Background profile sync
        dbService.ensureProfile(currentUser)
          .then((profileData) => {
            if (isMountedRef.current && profileData) {
              setUser((prev) => (prev ? buildNormalizedUser(prev, profileData) : prev));
            }
          })
          .catch((e) => console.warn('ensureProfile sync warning:', e));

        // Subscribe to live profile changes
        unsubProfiles?.();
        unsubProfiles = dbService.subscribeToTable('profiles', (payload) => {
          if (payload?.new && payload.new.id === currentUser.id && isMountedRef.current) {
            setUser((prev) => (prev ? buildNormalizedUser(prev, payload.new) : prev));
          }
        });
      } else {
        setUser(null);
        setLoading(false);
        resizeToLoginWindow();
      }
    });

    return () => {
      isMountedRef.current = false;
      clearTimeout(safetyTimer);
      subscription?.unsubscribe?.();
      unsubProfiles?.();
    };
  }, [buildNormalizedUser]);

  // Login handler
  const login = useCallback(async (email, password) => {
    try {
      const cleanEmail = (email || '').trim().toLowerCase();
      const { data, error } = await dbService.signIn(cleanEmail, password);

      if (error) {
        const errorText = getAuthErrorMessage(error);
        toast.error('Giriş Başarısız', { description: errorText });
        return { success: false, error: { ...error, message: errorText } };
      }

      if (data?.user) {
        const normalized = buildNormalizedUser(data.user);
        setUser(normalized);
        setSession(data.session || { user: data.user });
        await resizeToMainWindow();
        toast.success('Giriş Yapıldı', {
          description: `Hoş geldiniz, ${normalized.display_name}!`,
        });
        return { success: true, user: normalized };
      }

      return { success: false, error: new Error('Kullanıcı bilgisi alınamadı.') };
    } catch (err) {
      const errorText = getAuthErrorMessage(err);
      toast.error('Giriş Hatası', { description: errorText });
      return { success: false, error: { message: errorText } };
    }
  }, [buildNormalizedUser]);

  // Register handler
  const register = useCallback(async (email, password, username, displayName) => {
    try {
      const cleanEmail = (email || '').trim().toLowerCase();
      const safeUsername = (username || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '') || 'user';
      const safeDisplayName = displayName?.trim() || safeUsername;

      const { data, error } = await dbService.signUp(cleanEmail, password, {
        username: safeUsername,
        display_name: safeDisplayName,
      });

      if (error) {
        // Fallback for email rate limit in dev
        if (error.message && error.message.toLowerCase().includes('rate limit')) {
          const fallbackUser = {
            id: `usr-${Date.now()}`,
            email: cleanEmail,
            username: safeUsername,
            display_name: safeDisplayName,
            status: 'online',
            substatus: 'Çevrimiçi',
          };
          await dbService.ensureProfile(fallbackUser, { username: safeUsername, display_name: safeDisplayName });
          setUser(fallbackUser);
          setSession({ user: fallbackUser });
          await resizeToMainWindow();
          toast.success('Kayıt Başarılı (Test Modu)', {
            description: `Kota nedeniyle test oturumu açıldı: ${safeDisplayName}`,
          });
          return { success: true, user: fallbackUser };
        }

        // Offline fallback if network is unreachable
        if (error.isNetworkOrTimeout) {
          const localRes = await localDb.signUp({
            email: cleanEmail,
            password,
            options: {
              data: {
                username: safeUsername,
                display_name: safeDisplayName,
              },
            },
          });
          if (localRes?.data?.user) {
            const normalized = buildNormalizedUser(localRes.data.user);
            setUser(normalized);
            setSession(localRes.data.session);
            await resizeToMainWindow();
            toast.success('Hesap Oluşturuldu (Yerel Mod)', {
              description: `Voys'a hoş geldiniz, ${safeDisplayName}!`,
            });
            return { success: true, user: normalized };
          }
        }

        const errorText = getAuthErrorMessage(error);
        toast.error('Kayıt Başarısız', { description: errorText });
        return { success: false, error: { ...error, message: errorText } };
      }

      // Check if user has an immediate session (Auto-confirm enabled)
      if (data?.session && data?.user) {
        const normalized = buildNormalizedUser(data.user);
        setUser(normalized);
        setSession(data.session);
        await resizeToMainWindow();
        toast.success('Hesap Oluşturuldu ve Giriş Yapıldı', {
          description: `Voys'a hoş geldiniz, ${safeDisplayName}!`,
        });
        return { success: true, user: normalized };
      }

      // Supabase email confirmation is enabled
      if (data?.user && !data?.session) {
        toast.info('Kayıt Başarılı! E-posta Onayı Gerekli', {
          description: 'Lütfen hesabınızı aktifleştirmek için gelen kutunuzdaki onay bağlantısına tıklayın.',
          duration: 8000,
        });
        return {
          success: true,
          needsEmailConfirmation: true,
          user: buildNormalizedUser(data.user),
        };
      }

      return { success: true, user: data?.user };
    } catch (err) {
      const errorText = getAuthErrorMessage(err);
      toast.error('Kayıt Hatası', { description: errorText });
      return { success: false, error: { message: errorText } };
    }
  }, [buildNormalizedUser]);

  // Request password reset email
  const resetPassword = useCallback(async (email) => {
    try {
      const cleanEmail = (email || '').trim().toLowerCase();
      if (!cleanEmail) {
        toast.error('Lütfen e-posta adresinizi girin.');
        return { success: false, error: new Error('E-posta adresi gerekli.') };
      }

      const { data, error } = await dbService.resetPasswordForEmail(cleanEmail);
      if (error) {
        const errorText = getAuthErrorMessage(error);
        toast.error('Şifre Sıfırlama Başarısız', { description: errorText });
        return { success: false, error: { ...error, message: errorText } };
      }

      toast.success('Şifre Sıfırlama Bağlantısı Gönderildi', {
        description: 'Lütfen e-posta gelen kutunuzu (ve spam klasörünü) kontrol edin.',
      });
      return { success: true, data };
    } catch (err) {
      const errorText = getAuthErrorMessage(err);
      toast.error('Hata Oluştu', { description: errorText });
      return { success: false, error: { message: errorText } };
    }
  }, []);

  // Update password (for authenticated user or password recovery mode)
  const updatePassword = useCallback(async (newPassword) => {
    try {
      if (!newPassword || newPassword.length < 6) {
        toast.error('Şifre en az 6 karakter olmalıdır.');
        return { success: false, error: new Error('Şifre çok kısa.') };
      }

      const { data, error } = await dbService.updateUserPassword(newPassword);
      if (error) {
        const errorText = getAuthErrorMessage(error);
        toast.error('Şifre Güncellenemedi', { description: errorText });
        return { success: false, error: { ...error, message: errorText } };
      }

      setIsPasswordRecovery(false);
      toast.success('Şifre Başarıyla Güncellendi', {
        description: 'Yeni şifreniz kaydedildi.',
      });
      return { success: true, user: data?.user };
    } catch (err) {
      const errorText = getAuthErrorMessage(err);
      toast.error('Bir hata oluştu', { description: errorText });
      return { success: false, error: { message: errorText } };
    }
  }, []);

  // Update email handler
  const updateEmail = useCallback(async (newEmail) => {
    try {
      const cleanEmail = (newEmail || '').trim().toLowerCase();
      const { data, error } = await dbService.updateUserEmail(cleanEmail);
      if (error) {
        const errorText = getAuthErrorMessage(error);
        toast.error('E-posta Güncellenemedi', { description: errorText });
        return { success: false, error: { ...error, message: errorText } };
      }
      setUser((prev) => (prev ? { ...prev, email: cleanEmail } : prev));
      toast.success('E-posta Güncellendi', {
        description: `Yeni e-posta adresiniz: ${cleanEmail}`,
      });
      return { success: true, user: data?.user };
    } catch (err) {
      const errorText = getAuthErrorMessage(err);
      toast.error('Bir hata oluştu', { description: errorText });
      return { success: false, error: { message: errorText } };
    }
  }, []);

  // Logout handler
  const logout = useCallback(async () => {
    try {
      chatService.leavePresence?.();
      await dbService.signOut();
      setUser(null);
      setSession(null);
      setIsPasswordRecovery(false);
      await resizeToLoginWindow();
      toast.info('Oturum Kapatıldı', {
        description: 'Voys hesabınızdan çıkış yapıldı.',
      });
    } catch (err) {
      console.error('Logout error:', err);
      setUser(null);
      setSession(null);
      await resizeToLoginWindow();
    }
  }, []);

  // Quick Demo / Test Login helper
  const loginAsDemo = useCallback(async (demoEmail = 'demo@standupp.local') => {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await dbService.signIn(demoEmail, 'password123');
        if (!error && data?.user) {
          const normalized = buildNormalizedUser(data.user);
          setUser(normalized);
          setSession(data.session || { user: data.user });
          await resizeToMainWindow();
          toast.success('Giriş Yapıldı', {
            description: `Hoş geldiniz, ${normalized.display_name}!`,
          });
          return { success: true, user: normalized };
        }
      } catch (e) {
        console.warn('Supabase demo login attempt:', e);
      }
    }

    const demoUser = {
      id: 'demo-user-id-001',
      email: demoEmail,
      username: 'demo_user',
      display_name: 'Demo Kullanıcı',
      avatar_url: '',
      status: 'online',
      substatus: 'Çevrimiçi',
    };
    setUser(demoUser);
    setSession({ user: demoUser });
    await resizeToMainWindow();
    toast.success('Hızlı Test Girişi Başarılı', {
      description: 'Demo test kullanıcısı olarak oturum açıldı.',
    });
    return { success: true, user: demoUser };
  }, [buildNormalizedUser]);

  // Local offline login handler
  const loginLocally = useCallback(async (email, password = '') => {
    try {
      const res = await localDb.signInWithPassword({ email, password });
      if (res?.data?.user) {
        const normalized = buildNormalizedUser(res.data.user);
        setUser(normalized);
        setSession(res.data.session);
        await resizeToMainWindow();
        toast.success('Yerel Mod ile Giriş Yapıldı', {
          description: `Giriş yapıldı: ${normalized.display_name}`,
        });
        return { success: true, user: normalized };
      }
      return { success: false, error: res?.error };
    } catch (e) {
      return { success: false, error: e };
    }
  }, [buildNormalizedUser]);

  // Synchronous user state updater to keep AuthContext in sync with profile edits
  const updateUser = useCallback((partial) => {
    setUser((prev) => {
      if (!prev) return prev;
      return buildNormalizedUser(prev, partial);
    });
  }, [buildNormalizedUser]);

  const value = {
    user,
    session,
    isAuthenticated: Boolean(user),
    loading,
    isPasswordRecovery,
    login,
    loginLocally,
    register,
    logout,
    resetPassword,
    updatePassword,
    updateEmail,
    updateUser,
    loginAsDemo,
    isSupabaseConfigured,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
