import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  RefreshCw,
  Trash2,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Wifi,
  WifiOff,
  ExternalLink,
  Search,
  Copy,
  X,
  Users,
  Database,
  HardDrive,
} from 'lucide-react';
import { toast } from 'sonner';
import { dbService } from '../lib/supabase';
import { chatService } from '../services/chatService';
import { isProtectedAdminIdentity } from '../utils/userPurge';

function formatBytes(bytes) {
  const num = Number(bytes) || 0;
  if (num === 0) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(num) / Math.log(k)));
  return `${(num / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function formatDateTr(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getPercent(used, limit) {
  if (!limit || limit <= 0) return 0;
  return Math.min(100, Math.round(((Number(used) || 0) / limit) * 1000) / 10);
}

function MetricRow({ icon: Icon, title, valueText, limitText }) {
  return (
    <div className="px-4 py-3 sm:py-3.5 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
      <div className="flex items-center space-x-3 min-w-0">
        <Icon size={18} className="text-white flex-shrink-0" />
        <div className="text-xs font-semibold text-white truncate">{title}</div>
      </div>

      <div className="flex-shrink-0 font-mono text-xs font-semibold text-white">
        {valueText} <span className="text-gray-500 font-normal">/ {limitText}</span>
      </div>
    </div>
  );
}

const USER_STATUS_LABELS = {
  online: { text: 'Çevrimiçi', dot: 'bg-emerald-400' },
  idle: { text: 'Boşta', dot: 'bg-amber-400' },
  dnd: { text: 'Rahatsız Etmeyin', dot: 'bg-rose-400' },
  invisible: { text: 'Görünmez', dot: 'bg-gray-500' },
  offline: { text: 'Çevrimdışı', dot: 'bg-gray-500' },
};

export const AdminMonitorTab = ({ onUserDeleted = null }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [runningCleanup, setRunningCleanup] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [groupsList, setGroupsList] = useState([]);
  const [subTab, setSubTab] = useState('users'); // 'users' | 'groups' | 'events' | 'storage' | 'tables'
  const [realtimeHealth, setRealtimeHealth] = useState(() => dbService.getRealtimeHealth?.() || { status: 'CONNECTING' });
  const [contextMenu, setContextMenu] = useState(null); // { x, y, user }
  const [deleteConfirmUser, setDeleteConfirmUser] = useState(null);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const contextMenuRef = useRef(null);

  const loadTelemetry = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading((prev) => (data ? prev : true));
    setRefreshing(true);
    setErrorMsg('');
    try {
      const [res, directGroups] = await Promise.all([
        dbService.fetchAdminTelemetry().catch((err) => {
          console.warn('fetchAdminTelemetry error:', err);
          return null;
        }),
        dbService.fetchAllGroupsForAdmin().catch(() => []),
      ]);
      if (res) setData(res);
      const groupsFromRes = res?.telemetry?.groups;
      if (Array.isArray(groupsFromRes) && groupsFromRes.length > 0) {
        setGroupsList(groupsFromRes);
      } else if (Array.isArray(directGroups)) {
        setGroupsList(directGroups);
      }
    } catch (err) {
      const msg = err?.message || 'Sistem verileri yüklenemedi.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [data]);

  useEffect(() => {
    loadTelemetry(false);
    const unsubHealth = dbService.subscribeRealtimeHealth?.((snap) => {
      setRealtimeHealth(snap);
    });
    return () => unsubHealth?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      loadTelemetry(true);
    }, 30000);
    return () => clearInterval(timer);
  }, [autoRefresh, loadTelemetry]);

  useEffect(() => {
    if (!contextMenu) return undefined;
    const handlePointerDown = (e) => {
      if (contextMenuRef.current && contextMenuRef.current.contains(e.target)) return;
      setContextMenu(null);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
      }
    };
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('mousedown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!deleteConfirmUser) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !deletingUserId) {
        setDeleteConfirmUser(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteConfirmUser, deletingUserId]);

  const handleRowContextMenu = useCallback((e, targetUser) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 236;
    const menuHeight = 188;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 720;
    const x = Math.max(8, Math.min(e.clientX, vw - menuWidth - 8));
    const y = Math.max(8, Math.min(e.clientY, vh - menuHeight - 8));
    setContextMenu({ x, y, user: targetUser });
  }, []);

  const handleCopyText = useCallback(async (text, label) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(String(text));
      toast.success(`${label} kopyalandı.`);
    } catch {
      toast.error(`${label} kopyalanamadı.`);
    } finally {
      setContextMenu(null);
    }
  }, []);

  const handleConfirmDeleteUser = useCallback(async () => {
    const target = deleteConfirmUser;
    if (!target?.id || deletingUserId) return;
    if (isProtectedAdminIdentity(target)) {
      toast.error('Ana yönetici hesabı silinemez.');
      setDeleteConfirmUser(null);
      return;
    }

    setDeletingUserId(target.id);
    try {
      const res = await dbService.deleteUserAccount(target.id);
      chatService.broadcastAccountDeleted(target.id);
      onUserDeleted?.(target.id);

      setData((prev) => {
        if (!prev) return prev;
        const nextUsers = Array.isArray(prev.users)
          ? prev.users.filter((item) => item.id !== target.id)
          : [];
        const prevTelemetry = prev.telemetry || {};
        const prevAuth = prevTelemetry.auth || {};
        const prevDb = prevTelemetry.database || {};
        return {
          ...prev,
          users: nextUsers,
          telemetry: {
            ...prevTelemetry,
            auth: {
              ...prevAuth,
              total_users: Math.max(0, (Number(prevAuth.total_users) || nextUsers.length) - 1),
            },
            database: {
              ...prevDb,
              profiles: Math.max(0, (Number(prevDb.profiles) || nextUsers.length) - 1),
            },
          },
        };
      });

      setDeleteConfirmUser(null);
      const dmCount = res?.deletedCounts?.directMessages ?? 0;
      const msgCount = res?.deletedCounts?.channelMessages ?? 0;
      const storageCount = res?.deletedStorageObjects ?? 0;
      toast.success(`@${target.username || target.display_name} kalıcı olarak silindi`, {
        description: `Auth, profil, ${dmCount} DM, ${msgCount} kanal mesajı ve ${storageCount} Storage dosyası kaldırıldı.`,
      });
      await loadTelemetry(true);
    } catch (err) {
      toast.error('Kullanıcı silinemedi', {
        description: err?.message || 'Silme işlemi sırasında beklenmeyen bir hata oluştu.',
      });
    } finally {
      setDeletingUserId(null);
    }
  }, [deleteConfirmUser, deletingUserId, loadTelemetry, onUserDeleted]);

  const handleManualCleanup = async () => {
    setRunningCleanup(true);
    try {
      const res = await dbService.runStorageCleanupNow({ maxAgeHours: 48, dryRun: false });
      const totalDeleted = (res?.deletedChatFiles || 0) + (res?.deletedOldAvatars || 0);
      toast.success(
        totalDeleted > 0
          ? `Temizlik tamamlandı: ${res.deletedChatFiles || 0} sohbet dosyası, ${res.deletedOldAvatars || 0} eski avatar silindi.`
          : 'Temizlik tamamlandı: 48 saati aşan silinecek dosya bulunmadı.'
      );
      await loadTelemetry(true);
    } catch (err) {
      toast.error(err?.message || 'Temizlik çalıştırılamadı.');
    } finally {
      setRunningCleanup(false);
    }
  };

  const users = useMemo(() => {
    const list = data?.users || [];
    const q = userSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((u) =>
      [u.username, u.display_name, u.email, u.id]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [data?.users, userSearch]);

  const effectiveGroups = useMemo(() => {
    const fromState = Array.isArray(groupsList) ? groupsList : [];
    if (fromState.length > 0) return fromState;
    const fromTelemetry = Array.isArray(data?.telemetry?.groups) ? data.telemetry.groups : [];
    return fromTelemetry;
  }, [groupsList, data?.telemetry?.groups]);

  const filteredGroups = useMemo(() => {
    const q = groupSearch.trim().toLowerCase();
    if (!q) return effectiveGroups;
    return effectiveGroups.filter((g) => {
      const cleanId = String(g.id || '').replace(/^(text-|voice-)/i, '');
      return [g.name, g.id, cleanId, `#${cleanId}`, g.creator_name, g.creator_username]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [effectiveGroups, groupSearch]);

  const telemetry = data?.telemetry || {};
  const dbInfo = telemetry.database || {};
  const authInfo = telemetry.auth || {};
  const storageInfo = telemetry.storage || {};
  const counts = telemetry.counts || {};
  const cronInfo = telemetry.cron || {};

  const isRtHealthy = realtimeHealth?.status === 'CONNECTED';

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Üst Başlık ve Kontroller */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div>
          <h3 className="text-base font-bold text-white">Sistem & İzleme</h3>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => loadTelemetry(true)}
            disabled={refreshing}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/25 hover:bg-indigo-600/40 text-indigo-200 border border-indigo-500/40 transition disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span>Yenile</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start space-x-2 text-xs text-rose-200">
          <AlertTriangle size={16} className="text-rose-400 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading && !data ? (
        <div className="py-12 flex items-center justify-center space-x-2 text-xs text-gray-400">
          <RefreshCw size={15} className="animate-spin text-indigo-400" />
          <span>Supabase sistem ve kullanıcı verileri yükleniyor...</span>
        </div>
      ) : (
        <>
          {/* Sistem & Veritabanı İzleme (Satır Düzeni) */}
          <div className="rounded-xl border border-white/10 bg-[#111115] divide-y divide-white/5 overflow-hidden">
            {/* Satır 1: Realtime Bağlantı Durumu */}
            <div className="px-4 py-3 sm:py-3.5 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center space-x-3 min-w-0">
                {isRtHealthy ? (
                  <Wifi size={18} className="text-white flex-shrink-0" />
                ) : (
                  <WifiOff size={18} className="text-white flex-shrink-0" />
                )}
                <div className="text-xs font-semibold text-white truncate">Realtime Bağlantı Durumu</div>
              </div>
              <div className="flex-shrink-0">
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                  isRtHealthy
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                }`}>
                  {isRtHealthy ? 'Bağlı' : (realtimeHealth?.status || 'Bağlantı Yok')}
                </span>
              </div>
            </div>

            {/* Satır 2: Veritabanı Alanı */}
            <MetricRow
              icon={Database}
              title="Veritabanı Alanı"
              valueText={formatBytes(dbInfo.size_bytes)}
              limitText={formatBytes(dbInfo.limit_bytes || 524288000)}
            />

            {/* Satır 3: Storage Depolama */}
            <MetricRow
              icon={HardDrive}
              title="Storage Depolama"
              valueText={formatBytes(storageInfo.total_bytes)}
              limitText={formatBytes(storageInfo.limit_bytes || 1073741824)}
            />

            {/* Satır 4: 30 Günlük Aktif Kullanıcı (MAU) */}
            <MetricRow
              icon={Users}
              title="30 Günlük Aktif Kullanıcı (MAU)"
              valueText={String(authInfo.mau_30d ?? 0)}
              limitText={(authInfo.mau_limit || 50000).toLocaleString('tr-TR')}
            />

            {/* Satır 5: Aktif DB Bağlantıları */}
            <MetricRow
              icon={Activity}
              title="Aktif DB Bağlantıları"
              valueText={String(dbInfo.active_connections ?? 0)}
              limitText={String(dbInfo.max_connections || 60)}
            />

            {/* Satır 6: 2 Günlük Otomatik Depolama Temizliği */}
            <div className="px-4 py-3 sm:py-3.5 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center space-x-3 min-w-0">
                <Trash2 size={18} className="text-white flex-shrink-0" />
                <div className="text-xs font-semibold text-white truncate">2 Günlük Otomatik Depolama Temizliği</div>
              </div>
              <div className="flex-shrink-0">
                <button
                  type="button"
                  onClick={handleManualCleanup}
                  disabled={runningCleanup}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 border border-rose-500/30 transition disabled:opacity-50 cursor-pointer"
                >
                  <Trash2 size={12} />
                  <span>{runningCleanup ? 'Temizleniyor...' : 'Temizliği Şimdi Çalıştır'}</span>
                </button>
              </div>
            </div>

            {/* Satır 7: Egress & Realtime Kotası */}
            <div className="px-4 py-3 sm:py-3.5 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center space-x-3 min-w-0">
                <ExternalLink size={18} className="text-white flex-shrink-0" />
                <div className="text-xs font-semibold text-white truncate">Egress (5 GB) & Realtime Kotası</div>
              </div>
              <div className="flex-shrink-0">
                <a
                  href="https://supabase.com/dashboard/project/kdxwyvommyyvtzpzmsbm/settings/billing/usage"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition"
                >
                  <span>Supabase Dashboard</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          </div>

          {/* Alt Sekmeler: Üyeler / Gruplar */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-white/10 pb-2">
            {[
              { id: 'users', label: 'Kayıtlı Üyeler' },
              { id: 'groups', label: 'Kurulan Gruplar' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${subTab === tab.id
                    ? 'bg-indigo-600/30 text-white border border-indigo-500/40'
                    : 'text-gray-400 hover:text-white bg-white/[0.03] border border-transparent'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* SEKME 1: Kayıtlı Üyeler */}
          {subTab === 'users' && (
            <div className="space-y-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Kullanıcı adı, e-posta veya ID ara..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#111115] border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div className="rounded-xl border border-white/10 overflow-x-auto bg-[#0e0e12]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-gray-400 bg-white/[0.02]">
                      <th className="py-2.5 px-3">Kullanıcı</th>
                      <th className="py-2.5 px-3">E-posta</th>
                      <th className="py-2.5 px-3">Kayıt Tarihi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {users.map((u) => {
                      const isContextTarget = contextMenu?.user?.id === u.id;
                      const isBeingDeleted = deletingUserId === u.id;
                      return (
                        <tr
                          key={u.id}
                          onContextMenu={(e) => handleRowContextMenu(e, u)}
                          title="Sağ tıklayarak kullanıcı işlemleri menüsünü açın"
                          className={`cursor-context-menu transition-colors select-none ${isBeingDeleted
                              ? 'opacity-50 bg-rose-500/10'
                              : isContextTarget
                                ? 'bg-indigo-500/10 ring-1 ring-inset ring-indigo-500/30'
                                : 'hover:bg-white/[0.03]'
                            }`}
                        >
                          <td className="py-2.5 px-3">
                            <div className="flex items-center space-x-2">
                              {u.avatar_url ? (
                                <img src={u.avatar_url} alt={u.username} className="w-7 h-7 rounded-full object-cover border border-white/10" />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-[11px]">
                                  {(u.display_name || u.username || '?')[0].toLocaleUpperCase('tr-TR')}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-semibold text-white flex items-center space-x-1">
                                  <span className="truncate max-w-[130px]">{u.display_name}</span>
                                  {u.is_admin && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                      ADMIN
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-gray-500 font-mono">@{u.username}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-gray-300 font-mono text-[11px]">
                            <div className="flex items-center space-x-1.5">
                              <span>{u.email || '—'}</span>
                              {u.email_confirmed_at && (
                                <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0" title="E-posta doğrulandı" />
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-gray-400 font-mono text-[11px] whitespace-nowrap">
                            {formatDateTr(u.created_at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SEKME: Kurulan Gruplar */}
          {subTab === 'groups' && (
            <div className="space-y-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={groupSearch}
                  onChange={(e) => setGroupSearch(e.target.value)}
                  placeholder="Grup adı veya ID ara..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#111115] border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div className="rounded-xl border border-white/10 overflow-x-auto bg-[#0e0e12]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-gray-400 bg-white/[0.02]">
                      <th className="py-2.5 px-3">Grup Adı</th>
                      <th className="py-2.5 px-3">Oluşturan</th>
                      <th className="py-2.5 px-3">Üye Sayısı</th>
                      <th className="py-2.5 px-3">Kurulma Tarihi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredGroups.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-gray-500 text-xs">
                          {groupSearch ? 'Aramaya uygun grup bulunamadı.' : 'Henüz kurulmuş bir grup bulunmuyor.'}
                        </td>
                      </tr>
                    ) : (
                      filteredGroups.map((g) => (
                        <tr key={g.id} className="hover:bg-white/[0.03] transition-colors select-none">
                          <td className="py-2.5 px-3">
                            <div className="flex items-center space-x-2.5">
                              {g.avatar_url ? (
                                <img
                                  src={g.avatar_url}
                                  alt={g.name}
                                  className="w-8 h-8 rounded-full object-cover border border-white/10 flex-shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 text-indigo-300 flex items-center justify-center font-bold text-xs flex-shrink-0">
                                  <Users size={14} className="text-indigo-400" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-semibold text-white truncate max-w-[200px]">{g.name}</div>
                                <div
                                  className="text-[10px] text-gray-500 font-mono truncate max-w-[200px]"
                                  title={g.id}
                                >
                                  #{String(g.id || '').replace(/^(text-|voice-)/i, '')}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-2.5 px-3">
                            <div className="flex items-center space-x-2">
                              {g.creator_avatar_url ? (
                                <img
                                  src={g.creator_avatar_url}
                                  alt={g.creator_name || 'Kullanıcı'}
                                  className="w-6 h-6 rounded-full object-cover border border-white/10 flex-shrink-0"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                                  {(g.creator_name || g.creator_username || '?')[0].toLocaleUpperCase('tr-TR')}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="text-gray-200 font-medium truncate max-w-[140px]">
                                  {g.creator_name || 'Bilinmiyor'}
                                </div>
                                {g.creator_username && (
                                  <div className="text-[10px] text-gray-500 font-mono">@{g.creator_username}</div>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-gray-300">
                            <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[11px] font-medium">
                              <Users size={11} className="text-indigo-400" />
                              <span>{g.member_count ?? 1} üye</span>
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-gray-400 font-mono text-[11px] whitespace-nowrap">
                            {formatDateTr(g.created_at)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Sağ Tık Kullanıcı İşlemleri Menüsü */}
      {contextMenu && typeof document !== 'undefined' && createPortal(
        <div
          ref={contextMenuRef}
          onContextMenu={(e) => e.preventDefault()}
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-[210] w-56 rounded-2xl bg-[#131418] border border-white/10 shadow-xl p-2 text-xs text-gray-200 select-none"
        >
          <div className="px-2.5 py-1.5 border-b border-white/10 mb-1">
            <div className="font-semibold text-white truncate">
              {contextMenu.user.display_name || contextMenu.user.username || 'Kullanıcı'}
            </div>
            <div className="text-[11px] text-gray-400 font-mono truncate">
              @{contextMenu.user.username || 'kullanici'}
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleCopyText(contextMenu.user.id, 'Kullanıcı ID')}
            className="w-full flex items-center space-x-2 px-2.5 py-2 rounded-lg hover:bg-white/10 text-gray-200 transition-colors text-left"
          >
            <Copy size={13} className="text-gray-400 flex-shrink-0" />
            <span>Kullanıcı ID Kopyala</span>
          </button>

          {contextMenu.user.email && (
            <button
              type="button"
              onClick={() => handleCopyText(contextMenu.user.email, 'E-posta adresi')}
              className="w-full flex items-center space-x-2 px-2.5 py-2 rounded-lg hover:bg-white/10 text-gray-200 transition-colors text-left"
            >
              <Copy size={13} className="text-gray-400 flex-shrink-0" />
              <span>E-postayı Kopyala</span>
            </button>
          )}

          <div className="border-t border-white/10 my-1" />

          {isProtectedAdminIdentity(contextMenu.user) ? (
            <div
              className="w-full flex items-center space-x-2 px-2.5 py-2 rounded-lg text-amber-300/70 opacity-75 cursor-not-allowed text-left"
              title="Ana yönetici hesabı güvenlik nedeniyle silinemez"
            >
              <ShieldAlert size={13} className="flex-shrink-0" />
              <span>Ana Yönetici Silinemez</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                const target = contextMenu.user;
                setContextMenu(null);
                setDeleteConfirmUser(target);
              }}
              className="w-full flex items-center space-x-2 px-2.5 py-2 rounded-lg text-rose-400 hover:bg-rose-500/15 hover:text-rose-300 transition-colors text-left font-medium"
            >
              <Trash2 size={13} className="flex-shrink-0" />
              <span>Kullanıcıyı Komple Sil</span>
            </button>
          )}
        </div>,
        document.body
      )}

      {/* Kalıcı Hesap Silme Onay Penceresi */}
      {deleteConfirmUser && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => {
            if (!deletingUserId) setDeleteConfirmUser(null);
          }}
          className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/80"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-[#121216] border border-white/10 shadow-2xl shadow-black/80 overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <AlertTriangle size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Kullanıcıyı Kalıcı Olarak Sil</h4>
                  <p className="text-[11px] text-gray-400">Bu işlem geri alınamaz</p>
                </div>
              </div>
              <button
                type="button"
                disabled={Boolean(deletingUserId)}
                onClick={() => setDeleteConfirmUser(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center space-x-3 p-3 rounded-xl bg-white/[0.03] border border-white/10">
                {deleteConfirmUser.avatar_url ? (
                  <img
                    src={deleteConfirmUser.avatar_url}
                    alt={deleteConfirmUser.username}
                    className="w-10 h-10 rounded-full object-cover border border-white/10 flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {(deleteConfirmUser.display_name || deleteConfirmUser.username || '?')[0].toLocaleUpperCase('tr-TR')}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white truncate">
                    {deleteConfirmUser.display_name || deleteConfirmUser.username}
                  </div>
                  <div className="text-xs text-gray-400 font-mono truncate">
                    @{deleteConfirmUser.username || 'kullanici'} · {deleteConfirmUser.email || 'E-posta yok'}
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono truncate mt-0.5">
                    ID: {deleteConfirmUser.id}
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-200 space-y-1.5 leading-relaxed">
                <div className="font-semibold text-rose-300">
                  Aşağıdaki tüm veriler hem Voys uygulamasından hem Supabase’den tamamen silinecek:
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-rose-200/90">
                  <li>Supabase Auth hesabı, tüm oturumlar ve profil kaydı</li>
                  <li>Kullanıcının gönderdiği/aldığı tüm DM ve kanal mesajları</li>
                  <li>Arkadaşlık ilişkileri ve grup üyelikleri</li>
                  <li>Storage (<code className="font-mono">avatars</code> / <code className="font-mono">chat-attachments</code>) dosyaları ve uygulama önbelleği</li>
                </ul>
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-1">
                <button
                  type="button"
                  disabled={Boolean(deletingUserId)}
                  onClick={() => setDeleteConfirmUser(null)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-gray-300 transition-colors disabled:opacity-40"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  disabled={Boolean(deletingUserId)}
                  onClick={handleConfirmDeleteUser}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition-colors disabled:opacity-60"
                >
                  <Trash2 size={13} />
                  <span>{deletingUserId ? 'Siliniyor...' : 'Evet, Hesabı ve Verileri Sil'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

