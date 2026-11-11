import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity,
  Database,
  HardDrive,
  Users,
  RefreshCw,
  Trash2,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Wifi,
  WifiOff,
  Clock,
  ExternalLink,
  Search,
  Server,
  FileArchive,
  MessageSquare,
  UserPlus,
  FolderOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { dbService } from '../lib/supabase';

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

function QuotaCard({ icon: Icon, label, usedText, limitText, percent, subText, accent = 'indigo' }) {
  const barColor =
    percent >= 85
      ? 'bg-rose-500'
      : percent >= 65
        ? 'bg-amber-400'
        : accent === 'emerald'
          ? 'bg-emerald-500'
          : accent === 'cyan'
            ? 'bg-cyan-400'
            : accent === 'purple'
              ? 'bg-purple-500'
              : 'bg-indigo-500';

  return (
    <div className="p-3.5 rounded-xl bg-[#111115] border border-white/10 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs font-semibold text-gray-300">
          <Icon size={14} className="text-indigo-400" />
          <span>{label}</span>
        </div>
        <span className="text-[11px] font-mono font-semibold text-gray-400">%{percent}</span>
      </div>
      <div>
        <div className="flex items-baseline space-x-1.5">
          <span className="text-base font-bold text-white font-mono">{usedText}</span>
          <span className="text-[11px] text-gray-500 font-mono">/ {limitText}</span>
        </div>
        {subText && <p className="text-[11px] text-gray-500 mt-0.5">{subText}</p>}
      </div>
      <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.max(percent > 0 ? 3 : 0, percent)}%` }}
        />
      </div>
    </div>
  );
}

const EVENT_BADGES = {
  signup: { label: 'Kayıt', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', icon: UserPlus },
  channel_msg: { label: 'Grup Mesajı', cls: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30', icon: MessageSquare },
  dm_msg: { label: 'DM', cls: 'bg-purple-500/15 text-purple-300 border-purple-500/30', icon: MessageSquare },
  storage_upload: { label: 'Dosya', cls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30', icon: FileArchive },
  channel_create: { label: 'Yeni Grup', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30', icon: FolderOpen },
};

const USER_STATUS_LABELS = {
  online: { text: 'Çevrimiçi', dot: 'bg-emerald-400' },
  idle: { text: 'Boşta', dot: 'bg-amber-400' },
  dnd: { text: 'Rahatsız Etmeyin', dot: 'bg-rose-400' },
  invisible: { text: 'Görünmez', dot: 'bg-gray-500' },
  offline: { text: 'Çevrimdışı', dot: 'bg-gray-500' },
};

export const AdminMonitorTab = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [runningCleanup, setRunningCleanup] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [subTab, setSubTab] = useState('users'); // 'users' | 'events' | 'storage' | 'tables'
  const [realtimeHealth, setRealtimeHealth] = useState(() => dbService.getRealtimeHealth?.() || { status: 'CONNECTING' });

  const loadTelemetry = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading((prev) => (data ? prev : true));
    setRefreshing(true);
    setErrorMsg('');
    try {
      const res = await dbService.fetchAdminTelemetry();
      setData(res);
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

  const telemetry = data?.telemetry || {};
  const dbInfo = telemetry.database || {};
  const authInfo = telemetry.auth || {};
  const storageInfo = telemetry.storage || {};
  const counts = telemetry.counts || {};
  const cronInfo = telemetry.cron || {};
  const recentEvents = telemetry.recent_events || [];
  const recentObjects = storageInfo.recent_objects || [];
  const tableStats = telemetry.tables || [];

  const isRtHealthy = realtimeHealth?.status === 'CONNECTED';

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Üst Başlık ve Kontroller */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-base font-bold text-white">Sistem, Üye ve Supabase İzleme</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Admin Özel
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Anlık kotalar, kayıtlı kullanıcılar, veritabanı işlemleri ve 2 günlük otomatik dosya temizliği
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setAutoRefresh((v) => !v)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
              autoRefresh
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
            }`}
          >
            {autoRefresh ? 'Otomatik 30s: Açık' : 'Otomatik: Kapalı'}
          </button>

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

      {/* Canlı Bağlantı & Gecikme Durum Çubuğu */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#111115] border border-white/10">
        <div className="flex items-center space-x-2.5">
          {isRtHealthy ? (
            <Wifi size={16} className="text-emerald-400 flex-shrink-0" />
          ) : (
            <WifiOff size={16} className="text-amber-400 flex-shrink-0" />
          )}
          <div>
            <div className="flex items-center space-x-2 text-xs font-semibold text-white">
              <span>
                Realtime Durumu:{' '}
                <span className={isRtHealthy ? 'text-emerald-400' : 'text-amber-400'}>
                  {realtimeHealth?.status || 'Bilinmiyor'}
                </span>
              </span>
              <span className="text-gray-600">•</span>
              <span className="text-gray-400 font-mono text-[11px]">
                {realtimeHealth?.activeChannels || 0} aktif kanal
              </span>
              {typeof data?.client_roundtrip_ms === 'number' && (
                <>
                  <span className="text-gray-600">•</span>
                  <span className="text-indigo-300 font-mono text-[11px]">
                    Gecikme: {data.client_roundtrip_ms} ms (Sunucu {data.server_latency_ms} ms)
                  </span>
                </>
              )}
            </div>
            <p className="text-[11px] text-gray-500">
              Yeniden bağlanma: {realtimeHealth?.reconnectCount || 0} kez
              {data?.checked_at ? ` • Son güncelleme: ${formatDateTr(data.checked_at)}` : ''}
              {realtimeHealth?.lastError ? ` • Uyarı: ${realtimeHealth.lastError}` : ''}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            dbService.reconnectRealtime?.('admin_manual_reset');
            toast.info('Realtime kanalları tazeleniyor...');
          }}
          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition"
        >
          Realtime Yeniden Bağla
        </button>
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
          {/* Supabase Kullanım Limitleri Kartları */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <QuotaCard
              icon={Database}
              label="Veritabanı Alanı"
              usedText={formatBytes(dbInfo.size_bytes)}
              limitText={formatBytes(dbInfo.limit_bytes || 524288000)}
              percent={getPercent(dbInfo.size_bytes, dbInfo.limit_bytes || 524288000)}
              subText={`Toplam ${counts.channel_messages_total || 0} grup mesajı, ${counts.direct_messages_total || 0} DM`}
              accent="indigo"
            />
            <QuotaCard
              icon={HardDrive}
              label="Storage Depolama"
              usedText={formatBytes(storageInfo.total_bytes)}
              limitText={formatBytes(storageInfo.limit_bytes || 1073741824)}
              percent={getPercent(storageInfo.total_bytes, storageInfo.limit_bytes || 1073741824)}
              subText={`${storageInfo.total_objects || 0} dosya • ${storageInfo.expired_candidates || 0} tanesi 48s+ temizlik bekliyor`}
              accent="cyan"
            />
            <QuotaCard
              icon={Users}
              label="30 Günlük Aktif Kullanıcı (MAU)"
              usedText={String(authInfo.mau_30d ?? 0)}
              limitText={(authInfo.mau_limit || 50000).toLocaleString('tr-TR')}
              percent={getPercent(authInfo.mau_30d, authInfo.mau_limit || 50000)}
              subText={`Toplam ${authInfo.total_users ?? users.length} kayıtlı hesap • Son 24s: ${authInfo.active_24h || 0} aktif`}
              accent="emerald"
            />
            <QuotaCard
              icon={Server}
              label="Aktif DB Bağlantıları"
              usedText={String(dbInfo.active_connections ?? 0)}
              limitText={String(dbInfo.max_connections || 60)}
              percent={getPercent(dbInfo.active_connections, dbInfo.max_connections || 60)}
              subText={`${counts.channels_total || 0} grup • ${counts.friendships_accepted || 0} arkadaşlık (+${counts.friendships_pending || 0} bekleyen)`}
              accent="purple"
            />
          </div>

          {/* 2 Günlük Otomatik Temizlik + Egress Bilgi Kutusu */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-[#111115] border border-white/10 flex flex-col justify-between space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center space-x-1.5 text-xs font-semibold text-white">
                    <Clock size={14} className="text-emerald-400" />
                    <span>2 Günlük Otomatik Depolama Temizliği</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Zamanlama: <code className="text-indigo-300">{cronInfo.job?.schedule || '0 */6 * * *'}</code> (6 saatte bir) •
                    Durum: {cronInfo.job?.active ? <span className="text-emerald-400 font-semibold">Aktif</span> : <span className="text-amber-400">Pasif</span>}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    48 saati aşan sohbet dosyaları ve kullanılmayan eski avatarlar otomatik silinir.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-white/5">
                <span className="text-[11px] text-gray-400">
                  Bekleyen aday: <strong className="text-white">{storageInfo.expired_candidates || 0}</strong> dosya
                </span>
                <button
                  type="button"
                  onClick={handleManualCleanup}
                  disabled={runningCleanup}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 border border-rose-500/30 transition disabled:opacity-50"
                >
                  <Trash2 size={12} />
                  <span>{runningCleanup ? 'Temizleniyor...' : 'Temizliği Şimdi Çalıştır'}</span>
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#111115] border border-white/10 flex flex-col justify-between space-y-2">
              <div>
                <div className="flex items-center space-x-1.5 text-xs font-semibold text-white">
                  <Activity size={14} className="text-amber-400" />
                  <span>Egress (5 GB) & Realtime Kotası Hakkında</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                  Veritabanı boyutu, depolama, bağlantılar ve MAU doğrudan canlı ölçülür. Aylık Egress trafiği ve
                  Realtime mesaj kotası ise Supabase faturalandırma panelinde tutulur.
                </p>
              </div>
              <a
                href="https://supabase.com/dashboard/project/kdxwyvommyyvtzpzmsbm/settings/billing/usage"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1.5 text-[11px] font-semibold text-indigo-300 hover:text-indigo-200 transition w-fit"
              >
                <span>Supabase Usage Dashboard&apos;u Aç</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {/* Alt Sekmeler: Üyeler / Canlı Akış / Dosyalar / Tablolar */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-white/10 pb-2">
            {[
              { id: 'users', label: `Kayıtlı Üyeler (${users.length})` },
              { id: 'events', label: `Canlı İşlemler (${recentEvents.length})` },
              { id: 'storage', label: `Depolama Dosyaları (${recentObjects.length})` },
              { id: 'tables', label: `Tablo Performansı (${tableStats.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  subTab === tab.id
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
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start space-x-2 text-[11px] text-amber-200/90">
                <ShieldAlert size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <span>
                  Güvenlik notu: Supabase Auth kullanıcı şifrelerini tek yönlü <strong>bcrypt</strong> özeti olarak saklar;
                  açık metin şifreler teknik olarak okunamaz ve güvenlik gereği hiçbir zaman gösterilmez.
                </span>
              </div>

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
                      <th className="py-2.5 px-3">Durum</th>
                      <th className="py-2.5 px-3">Kayıt Tarihi</th>
                      <th className="py-2.5 px-3">Son Giriş</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {users.map((u) => {
                      const st = USER_STATUS_LABELS[u.status] || USER_STATUS_LABELS.offline;
                      return (
                        <tr key={u.id} className="hover:bg-white/[0.03] transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="flex items-center space-x-2">
                              {u.avatar_url ? (
                                <img src={u.avatar_url} alt={u.username} className="w-7 h-7 rounded-full object-cover border border-white/10" />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-[11px]">
                                  {(u.display_name || u.username || '?')[0].toUpperCase()}
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
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center space-x-1.5 text-[11px] text-gray-300">
                              <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                              <span>{st.text}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-gray-400 font-mono text-[11px] whitespace-nowrap">
                            {formatDateTr(u.created_at)}
                          </td>
                          <td className="py-2.5 px-3 text-gray-400 font-mono text-[11px] whitespace-nowrap">
                            {formatDateTr(u.last_sign_in_at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SEKME 2: Canlı İşlemler */}
          {subTab === 'events' && (
            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
              {recentEvents.map((ev, idx) => {
                const badge = EVENT_BADGES[ev.event_type] || {
                  label: ev.event_type,
                  cls: 'bg-white/10 text-gray-300 border-white/15',
                  icon: Activity,
                };
                const EvIcon = badge.icon;
                return (
                  <div
                    key={`${ev.event_type}_${ev.ts}_${idx}`}
                    className="p-2.5 rounded-xl bg-[#111115] border border-white/10 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border flex items-center space-x-1 flex-shrink-0 ${badge.cls}`}>
                        <EvIcon size={11} />
                        <span>{badge.label}</span>
                      </span>
                      <span className="font-semibold text-white truncate max-w-[140px]">{ev.actor}</span>
                      <span className="text-gray-400 truncate text-[11px] font-mono">{ev.detail}</span>
                    </div>
                    <span className="text-[10px] text-gray-500 font-mono whitespace-nowrap flex-shrink-0">
                      {formatDateTr(ev.ts)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* SEKME 3: Depolama Dosyaları */}
          {subTab === 'storage' && (
            <div className="rounded-xl border border-white/10 overflow-x-auto bg-[#0e0e12]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-gray-400 bg-white/[0.02]">
                    <th className="py-2.5 px-3">Bucket</th>
                    <th className="py-2.5 px-3">Dosya Yolu</th>
                    <th className="py-2.5 px-3">Boyut</th>
                    <th className="py-2.5 px-3">Durum</th>
                    <th className="py-2.5 px-3">Tarih</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recentObjects.map((obj) => (
                    <tr key={obj.id} className="hover:bg-white/[0.03]">
                      <td className="py-2 px-3 font-mono text-[11px] text-indigo-300">{obj.bucket_id}</td>
                      <td className="py-2 px-3 font-mono text-[11px] text-gray-300 truncate max-w-[220px]" title={obj.name}>
                        {obj.name}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-gray-400">{formatBytes(obj.size_bytes)}</td>
                      <td className="py-2 px-3 text-[11px]">
                        {obj.eligible_for_cleanup ? (
                          <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            48s+ Silinecek
                          </span>
                        ) : obj.in_use === true ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            Aktif Avatar
                          </span>
                        ) : obj.in_use === false ? (
                          <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            Eski Avatar (&lt;48s)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10">
                            Sohbet Eki
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                        {formatDateTr(obj.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* SEKME 4: Tablo Performansı */}
          {subTab === 'tables' && (
            <div className="rounded-xl border border-white/10 overflow-x-auto bg-[#0e0e12]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-gray-400 bg-white/[0.02]">
                    <th className="py-2.5 px-3">Tablo</th>
                    <th className="py-2.5 px-3">Canlı / Ölü Satır</th>
                    <th className="py-2.5 px-3">Seq Scan</th>
                    <th className="py-2.5 px-3">Index Scan</th>
                    <th className="py-2.5 px-3">Toplam Boyut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {tableStats.map((t) => (
                    <tr key={t.table_name} className="hover:bg-white/[0.03]">
                      <td className="py-2 px-3 font-mono font-semibold text-white">{t.table_name}</td>
                      <td className="py-2 px-3 font-mono text-[11px] text-gray-300">
                        {t.live_rows} <span className="text-gray-500">/ {t.dead_rows} ölü</span>
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-amber-300">{t.seq_scan}</td>
                      <td className="py-2 px-3 font-mono text-[11px] text-emerald-300">{t.idx_scan ?? 0}</td>
                      <td className="py-2 px-3 font-mono text-[11px] text-gray-400">{formatBytes(t.total_bytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

