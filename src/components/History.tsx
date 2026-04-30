import { useState, useMemo, useRef, useCallback } from 'react';
import { getSessions, saveSessions, getProfile } from '@/lib/storage';
import { ShiftSession, Entry } from '@/lib/types';
import { format, startOfWeek, parseISO } from 'date-fns';
import { Trash2, Pencil, Star, Clock, Activity, Coffee, Share2, Loader2 } from 'lucide-react';
import { useT } from '@/context/LangContext';
import { useIsLandscape } from '@/hooks/useIsLandscape';
import SweetAlert from './SweetAlert';
import AddEntryModal from './AddEntryModal';
import { generateAndShareDailyCard } from '@/lib/shareCard';

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

export default function History() {
  const t = useT();
  const isLandscape = useIsLandscape();
  const [tab, setTab] = useState<'daily' | 'weekly'>('daily');
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ShiftSession[]>(() =>
    getSessions().filter(s => s.endTime)
  );
  const [deletePeriodPending, setDeletePeriodPending] = useState<{ key: string; ss: ShiftSession[] } | null>(null);
  const [deleteEntryPending, setDeleteEntryPending] = useState<string | null>(null);
  const [editEntryPending, setEditEntryPending] = useState<Entry | null>(null);
  const [swipedDayKey, setSwipedDayKey] = useState<string | null>(null);
  const [sharingKey, setSharingKey] = useState<string | null>(null);
  const swipeTouchKey    = useRef<string | null>(null);
  const swipeTouchStartX = useRef(0);

  const dailyData = useMemo(() => {
    const grouped: Record<string, ShiftSession[]> = {};
    sessions.forEach(s => {
      if (!grouped[s.date]) grouped[s.date] = [];
      grouped[s.date].push(s);
    });
    return Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]));
  }, [sessions]);

  const weeklyData = useMemo(() => {
    const weeks: Record<string, ShiftSession[]> = {};
    sessions.forEach(s => {
      const d = parseISO(s.date);
      const ws = format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      if (!weeks[ws]) weeks[ws] = [];
      weeks[ws].push(s);
    });
    return Object.entries(weeks).sort((a, b) => b[0].localeCompare(a[0]));
  }, [sessions]);

  const calcStats = (ss: ShiftSession[]) => {
    const entries = ss.flatMap(s => s.entries);
    const trips = entries.filter(e => e.type === 'income').length;
    const gross = entries.filter(e => e.type === 'income').reduce((sum, e) => sum + (e.driverNet || 0), 0);
    const tips = entries.filter(e => e.type === 'income').reduce((sum, e) => sum + (e.tip || 0), 0);
    const expenses = entries.filter(e => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0);
    // รวมเวลา online ของทุก session ในกลุ่ม (เฉพาะที่จบแล้ว)
    const totalOnlineSecs = ss.reduce((sum, s) => {
      if (!s.endTime) return sum;
      return sum + Math.floor((new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 1000);
    }, 0);
    const totalMinutes = totalOnlineSecs / 60;
    const hours = Math.floor(totalMinutes / 60);
    const mins = Math.round(totalMinutes % 60);
    const onlineTime = totalOnlineSecs > 0
      ? hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
      : null;

    // Working time = sum of tripDuration from income entries (non-bonus)
    const workingSecs = entries
      .filter(e => e.type === 'income' && !e.note?.startsWith('Intensive:') && (e.tripDuration ?? 0) > 0)
      .reduce((sum, e) => sum + (e.tripDuration ?? 0), 0);
    const waitingSecs = Math.max(0, totalOnlineSecs - workingSecs);
    const workingTime = workingSecs > 0 ? formatDuration(workingSecs) : null;
    const waitingTime = workingSecs > 0 ? formatDuration(waitingSecs) : null;
    const onlineTimeFmt = totalOnlineSecs > 0 ? formatDuration(totalOnlineSecs) : null;

    return { trips, gross, tips, expenses, net: gross + tips - expenses, onlineTime, onlineTimeFmt, workingTime, waitingTime };
  };

  // Delete all sessions for a given date key (called after confirm)
  const confirmDeleteGroup = () => {
    if (!deletePeriodPending) return;
    const { key, ss } = deletePeriodPending;
    const groupIds = new Set(ss.map(s => s.id));
    const allSessions = getSessions();
    const updated = allSessions.filter(s => !groupIds.has(s.id));
    saveSessions(updated);
    setSessions(updated.filter(s => s.endTime));
    if (expandedDate === key) setExpandedDate(null);
    setDeletePeriodPending(null);
  };

  // Delete a single entry (called after confirm)
  const confirmDeleteEntry = () => {
    if (!deleteEntryPending) return;
    const allSessions = getSessions();
    const updated = allSessions.map(s => ({
      ...s,
      entries: s.entries.filter(e => e.id !== deleteEntryPending),
    }));
    saveSessions(updated);
    setSessions(updated.filter(s => s.endTime));
    setDeleteEntryPending(null);
  };

  const updateEntry = (entryId: string, updates: Omit<Entry, 'id' | 'sessionId' | 'timestamp'>) => {
    const allSessions = getSessions();
    const updated = allSessions.map(s => ({
      ...s,
      entries: s.entries.map(e => e.id === entryId ? { ...e, ...updates } : e),
    }));
    saveSessions(updated);
    setSessions(updated.filter(s => s.endTime));
    setEditEntryPending(null);
  };

  const handleShare = useCallback(async (date: string, ss: ShiftSession[]) => {
    if (sharingKey) return;
    setSharingKey(date);
    try {
      const lang = getProfile()?.language ?? 'th';
      await generateAndShareDailyCard(date, ss, lang);
    } catch (err) {
      console.error('Share failed:', err);
    } finally {
      setSharingKey(null);
    }
  }, [sharingKey]);

  const exportCSV = () => {
    const entries = sessions.flatMap(s => s.entries.map(e => ({ ...e, date: s.date })));
    const header = 'Date,Type,Amount,Tip,Category,Note\n';
    const rows = entries.map(e =>
      `${e.date},${e.type},${e.amount},${e.tip || 0},${e.expenseCategory || ''},${e.note || ''}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gb-driver-history.csv';
    a.click();
  };

  const data = tab === 'daily' ? dailyData : weeklyData;

  return (
    <div className={`p-4 space-y-5 relative animate-in fade-in slide-in-from-bottom-4 duration-500 ${isLandscape ? 'pb-4' : 'pb-28'}`}>
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10 translate-x-32 -translate-y-32"></div>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">{t('hist_title')}</h1>
        <button onClick={exportCSV} className="text-xs bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 px-4 py-2 rounded-xl font-bold transition-colors">
          {t('hist_export_csv')}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 bg-secondary/50 p-1.5 rounded-2xl border border-white/5">
        {(['daily', 'weekly'] as const).map(tabOption => (
          <button
            key={tabOption}
            onClick={() => setTab(tabOption)}
            className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
              tab === tabOption ? 'bg-primary/20 text-primary shadow-sm scale-[0.98]' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tabOption === 'daily' ? t('hist_daily') : t('hist_weekly')}
          </button>
        ))}
      </div>

      {data.map(([key, ss]) => {
        const stats = calcStats(ss);
        const isExpanded = expandedDate === key;
        const isSwiped   = swipedDayKey === key;
        const isSharing  = sharingKey === key;

        // ── Row header content (shared between daily/weekly) ──
        const rowContent = (
          <>
            <div>
              <p className="text-base font-bold text-white">
                {tab === 'daily'
                  ? format(parseISO(key), 'EEE, MMM d')
                  : `${t('hist_week_of')} ${format(parseISO(key), 'MMM d')}`}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs font-medium text-primary">{stats.trips} {t('hist_trips')}</p>
                {stats.onlineTime && (
                  <p className="text-xs font-medium text-muted-foreground">· {stats.onlineTime} {t('hist_online')}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="font-mono text-lg font-extrabold text-primary drop-shadow-sm">฿{stats.net.toFixed(0)}</p>
              <p className="text-xs font-medium text-muted-foreground">{t('hist_net')}</p>
            </div>
          </>
        );

        return (
          <div key={key} className="bg-card/70 backdrop-blur-xl border border-white/5 rounded-2xl overflow-hidden shadow-xl mb-3">

            {tab === 'daily' ? (
              /* ── Daily: share button always visible, swipe-left reveals delete ── */
              <div
                className="overflow-hidden"
                onTouchStart={e => {
                  swipeTouchKey.current    = key;
                  swipeTouchStartX.current = e.touches[0].clientX;
                }}
                onTouchEnd={e => {
                  if (swipeTouchKey.current !== key) return;
                  const delta = swipeTouchStartX.current - e.changedTouches[0].clientX;
                  if (delta > 40)  setSwipedDayKey(key);
                  if (delta < -20) setSwipedDayKey(null);
                  swipeTouchKey.current = null;
                }}
              >
                {/* Flex row wider than container; translate slides delete into view */}
                <div className={`flex transition-transform duration-200 ease-out ${isSwiped ? '-translate-x-16' : ''}`}>

                  {/* Full-width visible area: main content + share button */}
                  <div className="flex items-center shrink-0 w-full min-w-0">
                    <button
                      onClick={() => { setSwipedDayKey(null); setExpandedDate(isExpanded ? null : key); }}
                      className="flex-1 p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors min-w-0"
                    >
                      {rowContent}
                    </button>

                    {/* Share button — always visible */}
                    <button
                      onClick={() => handleShare(key, ss)}
                      disabled={!!sharingKey}
                      className="shrink-0 p-4 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all disabled:opacity-40"
                      title={t('hist_share')}
                    >
                      {isSharing
                        ? <Loader2 size={16} className="animate-spin text-primary" />
                        : <Share2 size={16} />}
                    </button>
                  </div>

                  {/* Delete button — hidden by overflow until swiped */}
                  <button
                    className="shrink-0 w-16 bg-destructive/90 hover:bg-destructive flex flex-col items-center justify-center gap-1 transition-colors"
                    onClick={() => { setSwipedDayKey(null); setDeletePeriodPending({ key, ss }); }}
                  >
                    <Trash2 size={18} className="text-white" />
                    <span className="text-[9px] text-white/80 font-bold">ลบ</span>
                  </button>

                </div>
              </div>
            ) : (
              /* ── Weekly: keep original delete button ── */
              <div className="flex items-center">
                <button
                  onClick={() => setExpandedDate(isExpanded ? null : key)}
                  className="flex-1 p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                >
                  {rowContent}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setDeletePeriodPending({ key, ss }); }}
                  className="p-4 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}

            {/* Expanded entries */}
            {isExpanded && (
              <div className="border-t border-white/5 p-4 space-y-3 bg-black/20">
                <div className="grid grid-cols-4 gap-2 text-center">
                  <MiniStat label={t('hist_gross')} value={stats.gross} />
                  <MiniStat label={t('hist_tips')} value={stats.tips} />
                  <MiniStat label={t('hist_expenses')} value={stats.expenses} />
                  <MiniStat label={t('hist_net_label')} value={stats.net} />
                </div>

                {/* Time breakdown — only shown when trip-duration data is available */}
                {(stats.onlineTimeFmt || stats.workingTime) && (
                  <div className="bg-secondary/40 rounded-xl border border-white/5 p-3 space-y-2">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('time_breakdown')}</p>
                    <div className="grid grid-cols-3 gap-2">
                      <TimeStatMini
                        icon={<Clock size={12} />}
                        label={t('time_online')}
                        value={stats.onlineTimeFmt ?? '—'}
                        color="text-white"
                      />
                      <TimeStatMini
                        icon={<Activity size={12} />}
                        label={t('time_working')}
                        value={stats.workingTime ?? '—'}
                        color="text-primary"
                      />
                      <TimeStatMini
                        icon={<Coffee size={12} />}
                        label={t('time_waiting')}
                        value={stats.waitingTime ?? '—'}
                        color="text-warning"
                      />
                    </div>
                  </div>
                )}
                {ss.flatMap(s => s.entries).length === 0 && (
                  <p className="text-center text-xs text-muted-foreground py-2">{t('hist_no_entries')}</p>
                )}
                {ss.flatMap(s => s.entries).map(e => {
                  const isIncome = e.type === 'income';
                  const isBonus = e.note?.startsWith('Intensive:');
                  const appDeducted = isIncome && e.appFare && e.driverNet && e.appFare > e.driverNet
                    ? Math.max(0, e.appFare - e.driverNet)
                    : 0;
                  const appDeductedPct = appDeducted > 0 && e.appFare
                    ? (appDeducted / e.appFare) * 100
                    : 0;

                  return (
                    <div key={e.id} className="bg-card border border-white/5 rounded-xl p-3 shadow-inner group">
                      <div className="flex items-start justify-between gap-2">
                        {/* Left: badge + details */}
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <span className={`shrink-0 text-[10px] font-mono font-bold px-2 py-1 rounded-md mt-0.5 ${
                            isIncome ? 'bg-primary/20 text-primary' : 'bg-destructive/20 text-destructive'
                          }`}>{isIncome ? 'IN' : 'EX'}</span>

                          <div className="min-w-0 flex-1">
                            {/* Row 1: label + platform + order type + tip */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-medium text-white">
                                {isIncome
                                  ? isBonus
                                    ? e.note
                                    : e.platform === 'vip' || e.platform === 'etc'
                                    ? (e.note || (e.platform === 'vip' ? t('dash_vip') : t('dash_etc')))
                                    : (e.orderType === 'express' ? t('add_express') : t('add_taxi'))
                                  : (e.expenseCategory || t('hist_trip_label'))}
                              </span>
                              {/* Platform badge */}
                              {isIncome && !isBonus && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase ${
                                  e.platform === 'bolt'
                                    ? 'bg-violet-500/20 text-violet-400 border border-violet-500/20'
                                    : e.platform === 'vip'
                                    ? 'bg-pink-500/20 text-pink-400 border border-pink-500/20'
                                    : e.platform === 'etc'
                                    ? 'bg-amber-400/15 text-amber-400 border border-amber-400/20'
                                    : 'bg-primary/15 text-primary border border-primary/20'
                                }`}>
                                  {e.platform === 'bolt' ? t('add_bolt')
                                   : e.platform === 'vip' ? t('add_vip')
                                   : e.platform === 'etc' ? t('add_etc')
                                   : t('add_grab')}
                                </span>
                              )}
                              {/* Tip badge */}
                              {e.tip && e.tip > 0 && (
                                <span className="flex items-center gap-0.5 text-[10px] font-bold text-warning bg-warning/10 border border-warning/20 px-1.5 py-0.5 rounded-md shrink-0">
                                  <Star size={9} fill="currentColor" />
                                  ฿{e.tip.toFixed(0)}
                                </span>
                              )}
                            </div>

                            {/* Row 2: timestamp + trip duration + fuel liters */}
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {format(new Date(e.timestamp), 'HH:mm')}
                              </span>
                              {e.tripDuration !== undefined && e.tripDuration > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary/80 bg-primary/10 border border-primary/15 px-1.5 py-0.5 rounded-md font-mono">
                                  ⏱ {formatDuration(e.tripDuration)}
                                </span>
                              )}
                              {e.fuelLiters && e.fuelPrice && (
                                <span className="text-[10px] text-primary/70 font-mono">
                                  · {e.fuelLiters.toFixed(2)}L @ ฿{e.fuelPrice.toFixed(2)}
                                </span>
                              )}
                            </div>

                            {/* Row 3: app deduction */}
                            {appDeducted > 0 && (
                              <div className="mt-1 flex items-center gap-1">
                                <span className="text-[10px] text-destructive/80 font-mono">
                                  {t('dash_app_deduction')} ฿{appDeducted.toFixed(0)} ({appDeductedPct.toFixed(1)}%)
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right: amount + edit + delete */}
                        <div className="flex items-center gap-1 shrink-0">
                          <span className={`font-mono text-sm font-bold mr-1 ${
                            isIncome && (e.driverNet || 0) < 0 ? 'text-destructive' : 'text-white'
                          }`}>
                            {isIncome
                              ? `฿${(e.driverNet || 0).toFixed(0)}`
                              : `-฿${e.amount.toFixed(0)}`}
                          </span>
                          <button
                            onClick={() => setEditEntryPending(e)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                            title="Edit entry"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setDeleteEntryPending(e.id)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                            title="Delete entry"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {data.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">{t('hist_no_history')}</div>
      )}

      {/* ── Edit entry modal ─────────────────────────────────────────────── */}
      {editEntryPending && (
        <AddEntryModal
          editEntry={editEntryPending}
          onSave={() => {}}
          onUpdate={updateEntry}
          onClose={() => setEditEntryPending(null)}
        />
      )}

      {/* ── Confirm delete period ─────────────────────────────────────────── */}
      <SweetAlert
        show={!!deletePeriodPending}
        icon="warning"
        title={t('alert_delete_period_title')}
        description={t('alert_delete_period_desc')}
        confirmText={t('alert_delete_period_confirm')}
        cancelText={t('alert_cancel')}
        onConfirm={confirmDeleteGroup}
        onCancel={() => setDeletePeriodPending(null)}
      />

      {/* ── Confirm delete entry ──────────────────────────────────────────── */}
      <SweetAlert
        show={!!deleteEntryPending}
        icon="warning"
        title={t('alert_delete_entry_title')}
        description={t('alert_delete_entry_desc')}
        confirmText={t('alert_delete_entry_confirm')}
        cancelText={t('alert_cancel')}
        onConfirm={confirmDeleteEntry}
        onCancel={() => setDeleteEntryPending(null)}
      />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono text-xs font-bold text-foreground">฿{value.toFixed(0)}</p>
    </div>
  );
}

function TimeStatMini({ icon, label, value, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-black/20 rounded-lg p-2 text-center border border-white/5 space-y-1">
      <div className={`flex justify-center ${color} opacity-70`}>{icon}</div>
      <p className={`font-mono font-bold text-xs ${color}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground leading-tight">{label}</p>
    </div>
  );
}
