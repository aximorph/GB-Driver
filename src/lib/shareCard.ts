/**
 * shareCard.ts
 * Generates a portrait share-card image (Canvas API, no external deps)
 * then downloads it or opens native share sheet.
 */
import { format, addDays, parseISO, startOfWeek } from 'date-fns';
import { ShiftSession, Entry } from './types';

// ── Palette ───────────────────────────────────────────────────────────────────
const BG       = '#0a0f0a';
const GREEN    = '#00f260';
const VIOLET   = '#8b5cf6';
const PINK     = '#ec4899';   // VIP colour
const YELLOW   = '#f5c518';   // tip colour
const WHITE    = '#ffffff';
const GRAY     = 'rgba(255,255,255,0.38)';
const GRAY_DIM = 'rgba(255,255,255,0.07)';
const DIVIDER  = 'rgba(255,255,255,0.07)';

const W     = 390;
const SCALE = 2;
const PAD   = 20;

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDur(secs: number): string {
  if (secs <= 0) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function byNetDesc(a: Entry, b: Entry) {
  return (b.driverNet || 0) - (a.driverNet || 0);
}

function orderLabel(e: Entry, lang: 'en' | 'th') {
  return e.orderType === 'express'
    ? (lang === 'th' ? 'ส่งของ' : 'Express')
    : (lang === 'th' ? 'แท็กซี่' : 'Taxi');
}

// ── Shared helpers ────────────────────────────────────────────────────────

interface CardTotals {
  grabNet: number; boltNet: number; vipNet: number;
  tips: number; bonusAmt: number; expenses: number;
  income: number; net: number; tripCount: number; onlineSecs: number;
}

function computeCardTotals(ss: ShiftSession[]): CardTotals {
  const all   = ss.flatMap(s => s.entries);
  const trips = all.filter(e => e.type === 'income' && !e.note?.startsWith('Intensive:'));
  const bonus = all.filter(e => e.type === 'income' &&  e.note?.startsWith('Intensive:'));
  const grab  = trips.filter(e => !e.platform || (e.platform !== 'bolt' && e.platform !== 'vip' && e.platform !== 'etc'));
  const bolt  = trips.filter(e => e.platform === 'bolt');
  const vip   = trips.filter(e => e.platform === 'vip');
  const net1  = (arr: Entry[]) => arr.reduce((s, e) => s + (e.driverNet || 0), 0);
  const grabNet  = net1(grab);
  const boltNet  = net1(bolt);
  const vipNet   = net1(vip);
  const tips     = trips.reduce((s, e) => s + (e.tip || 0), 0);
  const bonusAmt = net1(bonus);
  const expenses = all.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  const income   = grabNet + boltNet + vipNet + bonusAmt;
  const net      = income + tips - expenses;
  const onlineSecs = ss.reduce((s, sess) => {
    if (!sess.endTime) return s;
    return s + Math.floor((new Date(sess.endTime).getTime() - new Date(sess.startTime).getTime()) / 1000);
  }, 0);
  return { grabNet, boltNet, vipNet, tips, bonusAmt, expenses, income, net, tripCount: trips.length, onlineSecs };
}

function renderPlatformBar(
  ctx: CanvasRenderingContext2D, y: number,
  grabNet: number, boltNet: number, vipNet: number, tips: number,
  lang: 'en' | 'th', SANS: string, MONO: string,
): void {
  const H = 40;
  const parts: { lbl: string; amt: number; color: string; pre: string }[] = [];
  if (grabNet > 0) parts.push({ lbl: 'GRAB', amt: grabNet, color: GREEN,  pre: '฿'  });
  if (boltNet > 0) parts.push({ lbl: 'BOLT', amt: boltNet, color: VIOLET, pre: '฿'  });
  if (vipNet  > 0) parts.push({ lbl: 'VIP',  amt: vipNet,  color: PINK,   pre: '฿'  });
  if (tips    > 0) parts.push({ lbl: lang === 'th' ? 'ทิป' : 'TIPS', amt: tips, color: YELLOW, pre: '+฿' });
  if (!parts.length) return;

  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  ctx.fillRect(0, y, W, H);
  ctx.fillStyle = DIVIDER;
  ctx.fillRect(0, y, W, 1);

  const cw = (W - PAD * 2) / parts.length;
  parts.forEach((p, i) => {
    const cx = PAD + cw * i + cw / 2;
    if (i > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fillRect(PAD + cw * i, y + 8, 1, H - 16);
    }
    ctx.textAlign    = 'center';
    ctx.fillStyle    = GRAY;
    ctx.font         = `bold 8px ${SANS}`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(p.lbl, cx, y + H / 2 - 4);
    ctx.fillStyle    = p.color;
    ctx.font         = `bold 12px ${MONO}`;
    ctx.fillText(`${p.pre}${Math.round(p.amt)}`, cx, y + H / 2 + 11);
  });
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'alphabetic';
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function generateAndShareDailyCard(
  date: string,
  ss: ShiftSession[],
  lang: 'en' | 'th',
): Promise<void> {
  const allEntries  = ss.flatMap(s => s.entries);
  const incomeAll   = allEntries.filter(e => e.type === 'income');
  const incomeTrips = incomeAll.filter(e => !e.note?.startsWith('Intensive:'));
  const bonuses     = incomeAll.filter(e =>  e.note?.startsWith('Intensive:'));

  // ── Stats ──────────────────────────────────────────────────────────────────
  const gross    = incomeTrips.reduce((s, e) => s + (e.driverNet || 0), 0);
  const tips     = incomeTrips.reduce((s, e) => s + (e.tip    || 0), 0);
  const bonusAmt = bonuses.reduce((s, e) => s + (e.driverNet || 0), 0);
  const expenses = allEntries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);

  // Hero = gross + bonus (no tips)
  const income = gross + bonusAmt;
  const net    = income + tips - expenses;

  const tripCount = incomeTrips.length;

  // Online time
  const totalOnlineSecs = ss.reduce((sum, s) => {
    if (!s.endTime) return sum;
    return sum + Math.floor(
      (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 1000,
    );
  }, 0);
  const onlineStr = (() => {
    if (totalOnlineSecs <= 0) return '—';
    const h = Math.floor(totalOnlineSecs / 3600);
    const m = Math.floor((totalOnlineSecs % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  })();

  // Time range: earliest start → end of the LONGEST session.
  // Using longest session (not latest) prevents a short late-night open/close
  // from incorrectly appearing as the "end of work" time.
  const firstSession = ss.length > 0
    ? ss.reduce((a, b) => a.startTime < b.startTime ? a : b)
    : null;
  const longestSession = ss.reduce<ShiftSession | null>((best, s) => {
    if (!s.endTime) return best;
    const dur = new Date(s.endTime).getTime() - new Date(s.startTime).getTime();
    if (!best || !best.endTime) return s;
    const bestDur = new Date(best.endTime).getTime() - new Date(best.startTime).getTime();
    return dur > bestDur ? s : best;
  }, null);
  const timeRangeStr = firstSession
    ? format(new Date(firstSession.startTime), 'HH:mm') +
      (longestSession?.endTime ? '–' + format(new Date(longestSession.endTime), 'HH:mm') : '+')
    : '';

  // Avg trip duration
  const withDur    = incomeTrips.filter(e => (e.tripDuration ?? 0) > 0);
  const avgDurSecs = withDur.length > 0
    ? Math.round(withDur.reduce((s, e) => s + (e.tripDuration ?? 0), 0) / withDur.length)
    : 0;
  const avgDurStr = avgDurSecs > 0 ? fmtDur(avgDurSecs) : '—';

  // Working / waiting time (Option C: inline mini bar in online cell)
  const workingSecs  = withDur.reduce((s, e) => s + (e.tripDuration ?? 0), 0);
  const waitingSecs  = Math.max(0, totalOnlineSecs - workingSecs);
  const hasWorkData  = workingSecs > 0 && totalOnlineSecs > 0;
  const fmtShort = (secs: number): string => {
    if (secs <= 0) return '0m';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return h > 0 ? `${h}h${m}m` : `${m}m`;
  };

  // ── Platform split ────────────────────────────────────────────────────────
  // 'etc' entries are included in totals/stats but never shown as a column
  const grabAll = [...incomeTrips].filter(e => !e.platform || (e.platform !== 'bolt' && e.platform !== 'vip' && e.platform !== 'etc')).sort(byNetDesc);
  const boltAll = [...incomeTrips].filter(e => e.platform === 'bolt').sort(byNetDesc);
  const vipAll  = [...incomeTrips].filter(e => e.platform === 'vip').sort(byNetDesc);

  // Top-2 platforms by trip count (only platforms with data)
  const platforms = [
    { key: 'grab' as const, data: grabAll, color: GREEN,  label: 'Grab'  },
    { key: 'bolt' as const, data: boltAll, color: VIOLET, label: 'Bolt'  },
    { key: 'vip'  as const, data: vipAll,  color: PINK,   label: 'VIP'   },
  ].filter(p => p.data.length > 0)
   .sort((a, b) => b.data.length - a.data.length)
   .slice(0, 2);

  const hasDual = platforms.length === 2;

  // For each active platform
  const platA = platforms[0] ?? null;
  const platB = platforms[1] ?? null;

  const rowsA  = platA?.data.slice(0, 5) ?? [];
  const rowsB  = platB?.data.slice(0, 5) ?? [];
  const extraA = platA ? Math.max(0, platA.data.length - 5) : 0;
  const extraB = platB ? Math.max(0, platB.data.length - 5) : 0;

  const subtotalA = platA?.data.reduce((s, e) => s + (e.driverNet || 0), 0) ?? 0;
  const subtotalB = platB?.data.reduce((s, e) => s + (e.driverNet || 0), 0) ?? 0;
  const tipsA     = platA?.data.reduce((s, e) => s + (e.tip || 0), 0) ?? 0;
  const tipsB     = platB?.data.reduce((s, e) => s + (e.tip || 0), 0) ?? 0;

  // Legacy aliases for single-platform path
  const grabSubtotal = subtotalA;
  const boltSubtotal = subtotalB;
  const grabTips     = tipsA;
  const boltTips     = tipsB;

  // Single-platform
  const singleRows     = hasDual ? [] : rowsA;
  const singleExtra    = hasDual ? 0  : extraA;
  const singleSubtotal = hasDual ? 0  : subtotalA;
  const singleTips     = hasDual ? 0  : tipsA;
  const singleColor    = hasDual ? GREEN : (platA?.color ?? GREEN);

  // Tip subtotal rows (only drawn when tips > 0)
  const TIP_SUBTOTAL_H = 26;
  const hasDualTips   = hasDual && (grabTips > 0 || boltTips > 0);
  const hasSingleTips = !hasDual && singleTips > 0;
  const tipSubtotalH  = (hasDualTips || hasSingleTips) ? TIP_SUBTOTAL_H : 0;

  // ── Layout constants ──────────────────────────────────────────────────────
  const HEADER_H        = 66;
  const HERO_H          = 110;
  const STATS_H         = 93;   // +5px to fit working/waiting mini bar in online cell
  const SUBTOTAL_H      = 38;
  const PLATFORM_BAR_H  = incomeTrips.length > 0 ? 40 : 0;
  const FOOTER_H        = 48;

  // Dual-platform section heights
  const COL_HDR_H  = 32;
  const TRIP_H_D   = 42;   // slightly taller to fit tip line
  const MORE_H_D   = (hasDual && (extraA > 0 || extraB > 0)) ? 26 : 0;
  const dualRows   = Math.max(rowsA.length, rowsB.length);

  // Single-platform section heights
  const SEC_LBL_H = 34;
  const TRIP_H_S  = 46;   // slightly taller to fit tip line
  const MORE_H_S  = (!hasDual && singleExtra > 0) ? 32 : 0;

  const tripSection = hasDual
    ? COL_HDR_H + dualRows * TRIP_H_D + MORE_H_D + SUBTOTAL_H + tipSubtotalH
    : SEC_LBL_H + singleRows.length * TRIP_H_S + MORE_H_S + SUBTOTAL_H + tipSubtotalH;

  const totalH = HEADER_H + HERO_H + STATS_H + tripSection + PLATFORM_BAR_H + FOOTER_H;

  // ── Canvas setup ──────────────────────────────────────────────────────────
  const canvas    = document.createElement('canvas');
  canvas.width    = W * SCALE;
  canvas.height   = totalH * SCALE;
  const ctx       = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, totalH);

  const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
  const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';

  let y = 0;

  // ── HEADER ────────────────────────────────────────────────────────────────
  ctx.fillStyle = DIVIDER;
  ctx.fillRect(0, HEADER_H - 1, W, 1);

  ctx.fillStyle    = GREEN;
  ctx.font         = `bold 16px ${SANS}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('GB-Driver', PAD, y + 34);

  const dateLabel = (() => {
    const d = new Date(date + 'T12:00:00');
    return d.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    });
  })();
  ctx.fillStyle = GRAY;
  ctx.font      = `12px ${SANS}`;
  ctx.fillText(dateLabel, PAD, y + 52);

  // Badge
  const BADGE = 'DAILY RECAP';
  ctx.font = `bold 9px ${SANS}`;
  const bW  = ctx.measureText(BADGE).width + 18;
  const bX  = W - PAD - bW;
  const bY  = y + 20;
  roundRect(ctx, bX, bY, bW, 18, 9);
  ctx.fillStyle   = 'rgba(0,242,96,0.08)';  ctx.fill();
  ctx.strokeStyle = 'rgba(0,242,96,0.28)';  ctx.lineWidth = 1;  ctx.stroke();
  ctx.fillStyle    = GREEN;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(BADGE, bX + bW / 2, bY + 9);
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'alphabetic';

  y += HEADER_H;

  // ── HERO ──────────────────────────────────────────────────────────────────
  ctx.fillStyle = DIVIDER;
  ctx.fillRect(0, y + HERO_H - 1, W, 1);

  const INCOME_LBL = lang === 'th' ? 'รายรับ (ไม่รวมทิป)' : 'INCOME (excl. tips)';
  ctx.fillStyle    = GRAY;
  ctx.font         = `11px ${SANS}`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(INCOME_LBL.toUpperCase(), W / 2, y + 22);

  ctx.fillStyle    = WHITE;
  ctx.font         = `bold 46px ${MONO}`;
  ctx.textAlign    = 'center';
  ctx.fillText(`฿${Math.round(income)}`, W / 2, y + 70);

  // Sub row: net · tip · exp
  const subParts = [
    `${lang === 'th' ? 'สุทธิ' : 'Net'} ฿${Math.round(net)}`,
    `${lang === 'th' ? 'ทิป' : 'Tip'} ฿${Math.round(tips)}`,
    `${lang === 'th' ? 'รายจ่าย' : 'Exp'} ฿${Math.round(expenses)}`,
  ];
  ctx.fillStyle = GRAY;
  ctx.font      = `11px ${SANS}`;
  ctx.fillText(subParts.join('  ·  '), W / 2, y + HERO_H - 18);
  ctx.textAlign = 'left';

  y += HERO_H;

  // ── STATS ─────────────────────────────────────────────────────────────────
  ctx.fillStyle = DIVIDER;
  ctx.fillRect(0, y + STATS_H - 1, W, 1);

  const statCells = [
    { val: tripCount.toString(), lbl: lang === 'th' ? 'รอบทั้งหมด' : 'trips',    sub: '' },
    { val: onlineStr,            lbl: lang === 'th' ? 'ออนไลน์'    : 'online',   sub: timeRangeStr },
    { val: avgDurStr,            lbl: lang === 'th' ? 'เฉลี่ย/รอบ' : 'avg/trip', sub: '' },
  ];
  const cellW = W / 3;
  statCells.forEach((cell, i) => {
    const cx = cellW * i + cellW / 2;
    // Online cell: shift content up when work data exists, to make room for bar
    const midOffset = (i === 1 && hasWorkData) ? (STATS_H / 2 - 13) : (STATS_H / 2 - 4);
    const mid = y + midOffset;
    if (i > 0) { ctx.fillStyle = DIVIDER; ctx.fillRect(cellW * i, y + 14, 1, STATS_H - 28); }
    ctx.fillStyle    = WHITE;
    ctx.font         = `bold 20px ${MONO}`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(cell.val, cx, mid + 4);
    ctx.fillStyle = GRAY;
    ctx.font      = `9px ${SANS}`;
    ctx.fillText(cell.lbl.toUpperCase(), cx, mid + 20);
    // Time-range sub-label (online cell only)
    if (cell.sub) {
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.font      = `8px ${MONO}`;
      ctx.fillText(cell.sub, cx, mid + 34);
    }
    // Working / waiting mini bar (online cell only, when trip duration data exists)
    if (i === 1 && hasWorkData) {
      const barW  = 84;
      const barX  = cx - barW / 2;
      const barY  = y + 77;
      const barH  = 3;
      const workW = Math.max(1, Math.round(barW * workingSecs / totalOnlineSecs));
      // Background rail (represents waiting time)
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(barX, barY, barW, barH);
      // Work segment (green)
      ctx.fillStyle = 'rgba(0,242,96,0.60)';
      ctx.fillRect(barX, barY, workW, barH);
      // Labels: "ทำ Xm" left, "รอ Xm" right
      const workLbl = (lang === 'th' ? 'ทำ ' : 'work ') + fmtShort(workingSecs);
      const waitLbl = (lang === 'th' ? 'รอ ' : 'wait ') + fmtShort(waitingSecs);
      ctx.font         = `bold 8px ${MONO}`;
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle    = 'rgba(0,242,96,0.70)';
      ctx.textAlign    = 'left';
      ctx.fillText(workLbl, barX, y + 89);
      ctx.fillStyle = 'rgba(255,255,255,0.32)';
      ctx.textAlign = 'right';
      ctx.fillText(waitLbl, barX + barW, y + 89);
    }
  });
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'alphabetic';
  y += STATS_H;

  // ── TRIP SECTION ──────────────────────────────────────────────────────────
  if (hasDual) {
    // ── DUAL PLATFORM ────────────────────────────────────────────────────────
    const MID = W / 2;
    const L0  = PAD;        // grab col left edge
    const L1  = MID - 5;   // grab col right edge
    const R0  = MID + 5;   // bolt col left edge
    const R1  = W - PAD;   // bolt col right edge

    // Column headers
    const drawColHeader = (
      label: string, count: number, x0: number, x1: number, color: string,
    ) => {
      ctx.fillStyle    = color;
      ctx.font         = `bold 11px ${SANS}`;
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x0 + 10, y + COL_HDR_H / 2);
      const cntStr = `${count} ${lang === 'th' ? 'รอบ' : 'trips'}`;
      ctx.fillStyle = 'rgba(255,255,255,0.30)';
      ctx.font      = `9px ${SANS}`;
      ctx.textAlign = 'right';
      ctx.fillText(cntStr, x1, y + COL_HDR_H / 2);
      ctx.textAlign = 'left';
    };

    drawColHeader(platA!.label, platA!.data.length, L0, L1, platA!.color);
    drawColHeader(platB!.label, platB!.data.length, R0, R1, platB!.color);

    // Center divider (runs through entire trip section)
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(MID - 1, y, 2, tripSection);

    // Bottom border of col headers
    ctx.fillStyle = DIVIDER;
    ctx.fillRect(L0, y + COL_HDR_H - 1, L1 - L0, 1);
    ctx.fillRect(R0, y + COL_HDR_H - 1, R1 - R0, 1);

    y += COL_HDR_H;

    // Draw one trip row inside a column
    const drawDualRow = (
      e: Entry | null, rowY: number, rowH: number,
      x0: number, x1: number, color: string, isAlt: boolean,
    ) => {
      if (isAlt) {
        ctx.fillStyle = GRAY_DIM;
        ctx.fillRect(x0, rowY, x1 - x0, rowH);
      }
      if (!e) return;

      const hasTip = (e.tip ?? 0) > 0;
      // Shift content up when tip is shown so both lines fit
      const shift = hasTip ? -4 : 0;
      const rowMid = rowY + rowH / 2 + shift;

      // dot
      ctx.beginPath();
      ctx.arc(x0 + 6, rowY + rowH / 2, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // order type
      ctx.fillStyle    = 'rgba(255,255,255,0.75)';
      ctx.font         = `10px ${SANS}`;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(orderLabel(e, lang), x0 + 15, rowMid - 2);

      // time
      const timeStr = format(new Date(e.timestamp), 'HH:mm');
      ctx.fillStyle = GRAY;
      ctx.font      = `9px ${MONO}`;
      ctx.fillText(timeStr, x0 + 15, rowMid + 10);

      // driverNet (right-aligned, top)
      const amtStr = `฿${Math.round(e.driverNet || 0)}`;
      ctx.fillStyle    = WHITE;
      ctx.font         = `bold 11px ${MONO}`;
      ctx.textAlign    = 'right';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(amtStr, x1, rowMid - 2);

      // tip (right-aligned, bottom, yellow)
      if (hasTip) {
        const tipStr = `+฿${Math.round(e.tip!)} tip`;
        ctx.fillStyle = YELLOW;
        ctx.font      = `8px ${MONO}`;
        ctx.fillText(tipStr, x1, rowMid + 11);
      }

      ctx.textAlign    = 'left';
      ctx.textBaseline = 'alphabetic';

      // row divider
      ctx.fillStyle = DIVIDER;
      ctx.fillRect(x0, rowY + rowH - 1, x1 - x0, 1);
    };

    for (let i = 0; i < dualRows; i++) {
      const rowY  = y + i * TRIP_H_D;
      const isAlt = i % 2 === 0;
      drawDualRow(rowsA[i] ?? null, rowY, TRIP_H_D, L0, L1, platA!.color, isAlt);
      drawDualRow(rowsB[i] ?? null, rowY, TRIP_H_D, R0, R1, platB!.color, isAlt);
    }
    y += dualRows * TRIP_H_D;

    // "More" row (combined)
    if (MORE_H_D > 0) {
      const drawMore = (extra: number, x0: number, x1: number) => {
        if (extra <= 0) return;
        const moreStr = lang === 'th' ? `+${extra} รอบ` : `+${extra} more`;
        ctx.fillStyle    = GRAY;
        ctx.font         = `9px ${SANS}`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(moreStr, (x0 + x1) / 2, y + MORE_H_D / 2);
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'alphabetic';
      };
      drawMore(extraA, L0, L1);
      drawMore(extraB, R0, R1);
      ctx.fillStyle = DIVIDER;
      ctx.fillRect(L0, y + MORE_H_D - 1, L1 - L0, 1);
      ctx.fillRect(R0, y + MORE_H_D - 1, R1 - R0, 1);
      y += MORE_H_D;
    }

    // driverNet subtotal row
    const drawSubtotal = (
      subtotal: number, x0: number, x1: number, color: string,
    ) => {
      const lbl = lang === 'th' ? 'รวม' : 'Total';
      ctx.fillStyle    = 'rgba(255,255,255,0.05)';
      ctx.fillRect(x0, y, x1 - x0, SUBTOTAL_H);
      ctx.fillStyle    = 'rgba(255,255,255,0.30)';
      ctx.font         = `bold 9px ${SANS}`;
      ctx.textBaseline = 'middle';
      ctx.fillText(lbl.toUpperCase(), x0 + 10, y + SUBTOTAL_H / 2);
      const amtStr = `฿${Math.round(subtotal)}`;
      ctx.fillStyle    = color;
      ctx.font         = `bold 13px ${MONO}`;
      ctx.textAlign    = 'right';
      ctx.fillText(amtStr, x1, y + SUBTOTAL_H / 2);
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'alphabetic';
    };
    drawSubtotal(subtotalA, L0, L1, platA!.color);
    drawSubtotal(subtotalB, R0, R1, platB!.color);
    y += SUBTOTAL_H;

    // Tips subtotal row (only if any tips exist)
    if (hasDualTips) {
      const drawTipSubtotal = (tipAmt: number, x0: number, x1: number) => {
        ctx.fillStyle    = 'rgba(245,197,24,0.06)';
        ctx.fillRect(x0, y, x1 - x0, TIP_SUBTOTAL_H);
        const lbl = lang === 'th' ? 'ทิปรวม' : 'Tips';
        ctx.fillStyle    = 'rgba(245,197,24,0.55)';
        ctx.font         = `bold 8px ${SANS}`;
        ctx.textBaseline = 'middle';
        ctx.fillText(lbl.toUpperCase(), x0 + 10, y + TIP_SUBTOTAL_H / 2);
        if (tipAmt > 0) {
          const tipStr = `+฿${Math.round(tipAmt)}`;
          ctx.fillStyle = YELLOW;
          ctx.font      = `bold 11px ${MONO}`;
          ctx.textAlign = 'right';
          ctx.fillText(tipStr, x1, y + TIP_SUBTOTAL_H / 2);
          ctx.textAlign = 'left';
        }
        ctx.textBaseline = 'alphabetic';
      };
      drawTipSubtotal(tipsA, L0, L1);
      drawTipSubtotal(tipsB, R0, R1);
      y += TIP_SUBTOTAL_H;
    }

  } else {
    // ── SINGLE PLATFORM ───────────────────────────────────────────────────────
    const secLbl = lang === 'th'
      ? `รายการ (เรียงตามยอด) · ${Math.min(tripCount, 5)}/${tripCount}`
      : `Trips by amount · ${Math.min(tripCount, 5)} of ${tripCount}`;
    ctx.fillStyle    = 'rgba(255,255,255,0.22)';
    ctx.font         = `bold 9px ${SANS}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(secLbl.toUpperCase(), PAD, y + SEC_LBL_H / 2);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = DIVIDER;
    ctx.fillRect(0, y + SEC_LBL_H - 1, W, 1);
    y += SEC_LBL_H;

    singleRows.forEach((e, i) => {
      const rowY   = y + i * TRIP_H_S;
      const rowMid = rowY + TRIP_H_S / 2;
      const hasTip = (e.tip ?? 0) > 0;

      if (i % 2 === 0) { ctx.fillStyle = GRAY_DIM; ctx.fillRect(0, rowY, W, TRIP_H_S); }

      // dot
      ctx.beginPath();
      ctx.arc(PAD + 5, rowMid, 4, 0, Math.PI * 2);
      ctx.fillStyle = singleColor;
      ctx.fill();

      // platform + order type (top line)
      const platName = platA?.label ?? 'Grab';
      ctx.fillStyle    = singleColor;
      ctx.font         = `bold 11px ${SANS}`;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(platName, PAD + 14, rowMid - 3);
      const platW = ctx.measureText(platName).width;
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font      = `11px ${SANS}`;
      ctx.fillText(` · ${orderLabel(e, lang)}`, PAD + 14 + platW, rowMid - 3);

      // time + duration (bottom line)
      const timeStr = format(new Date(e.timestamp), 'HH:mm');
      ctx.fillStyle = GRAY;
      ctx.font      = `10px ${MONO}`;
      ctx.fillText(timeStr, PAD + 14, rowMid + 13);
      if (e.tripDuration && e.tripDuration > 0) {
        const tw = ctx.measureText(timeStr).width;
        ctx.fillStyle = 'rgba(0,242,96,0.55)';
        ctx.font      = `bold 10px ${MONO}`;
        ctx.fillText(`  ⏱ ${fmtDur(e.tripDuration)}`, PAD + 14 + tw, rowMid + 13);
      }

      // driverNet (top-right)
      const amtStr = `฿${Math.round(e.driverNet || 0)}`;
      ctx.fillStyle    = WHITE;
      ctx.font         = `bold 13px ${MONO}`;
      ctx.textAlign    = 'right';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(amtStr, W - PAD, rowMid - 3);

      // tip (bottom-right, yellow)
      if (hasTip) {
        const tipStr = `+฿${Math.round(e.tip!)} tip`;
        ctx.fillStyle = YELLOW;
        ctx.font      = `bold 10px ${MONO}`;
        ctx.fillText(tipStr, W - PAD, rowMid + 13);
      }

      ctx.textAlign    = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = DIVIDER;
      ctx.fillRect(PAD, rowY + TRIP_H_S - 1, W - PAD * 2, 1);
    });
    y += singleRows.length * TRIP_H_S;

    // "More" row
    if (MORE_H_S > 0) {
      const moreStr = lang === 'th'
        ? `· · · และอีก ${singleExtra} รอบ · · ·`
        : `· · · and ${singleExtra} more trips · · ·`;
      ctx.fillStyle    = GRAY;
      ctx.font         = `10px ${SANS}`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(moreStr, W / 2, y + MORE_H_S / 2);
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'alphabetic';
      y += MORE_H_S;
    }

    // driverNet subtotal row
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, y, W, SUBTOTAL_H);
    const subLbl = lang === 'th' ? 'รวมรายรับ' : 'Total Income';
    ctx.fillStyle    = 'rgba(255,255,255,0.30)';
    ctx.font         = `bold 9px ${SANS}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(subLbl.toUpperCase(), PAD, y + SUBTOTAL_H / 2);
    const subAmtStr = `฿${Math.round(singleSubtotal)}`;
    ctx.fillStyle    = singleColor;
    ctx.font         = `bold 14px ${MONO}`;
    ctx.textAlign    = 'right';
    ctx.fillText(subAmtStr, W - PAD, y + SUBTOTAL_H / 2);
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';
    y += SUBTOTAL_H;

    // Tips subtotal row (only if tips exist)
    if (hasSingleTips) {
      ctx.fillStyle = 'rgba(245,197,24,0.06)';
      ctx.fillRect(0, y, W, TIP_SUBTOTAL_H);
      const tipLbl = lang === 'th' ? 'ทิปรวม' : 'Tips Total';
      ctx.fillStyle    = 'rgba(245,197,24,0.55)';
      ctx.font         = `bold 8px ${SANS}`;
      ctx.textBaseline = 'middle';
      ctx.fillText(tipLbl.toUpperCase(), PAD, y + TIP_SUBTOTAL_H / 2);
      const tipAmtStr = `+฿${Math.round(singleTips)}`;
      ctx.fillStyle    = YELLOW;
      ctx.font         = `bold 12px ${MONO}`;
      ctx.textAlign    = 'right';
      ctx.fillText(tipAmtStr, W - PAD, y + TIP_SUBTOTAL_H / 2);
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'alphabetic';
      y += TIP_SUBTOTAL_H;
    }
  }

  // ── PLATFORM BREAKDOWN BAR ───────────────────────────────────────────────
  if (PLATFORM_BAR_H > 0) {
    const grabNetTotal = grabAll.reduce((s, e) => s + (e.driverNet || 0), 0);
    const boltNetTotal = boltAll.reduce((s, e) => s + (e.driverNet || 0), 0);
    const vipNetTotal  = vipAll.reduce((s, e)  => s + (e.driverNet || 0), 0);
    renderPlatformBar(ctx, y, grabNetTotal, boltNetTotal, vipNetTotal, tips, lang, SANS, MONO);
    y += PLATFORM_BAR_H;
  }

  // ── FOOTER ────────────────────────────────────────────────────────────────
  ctx.fillStyle = DIVIDER;
  ctx.fillRect(0, y, W, 1);

  ctx.fillStyle    = 'rgba(255,255,255,0.18)';
  ctx.font         = `10px ${SANS}`;
  ctx.textBaseline = 'middle';
  ctx.fillText('gb-driver.com', PAD, y + FOOTER_H / 2);

  ctx.fillStyle = 'rgba(0,242,96,0.32)';
  ctx.font      = `bold 12px ${SANS}`;
  ctx.textAlign = 'right';
  ctx.fillText('GB-Driver', W - PAD, y + FOOTER_H / 2);
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'alphabetic';

  // ── Share / Download ──────────────────────────────────────────────────────
  const blob = await new Promise<Blob | null>(resolve =>
    canvas.toBlob(resolve, 'image/png'),
  );
  if (!blob) return;

  const filename = `gb-driver-${date}.png`;
  const file     = new File([blob], filename, { type: 'image/png' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'GB-Driver Daily Summary' });
      return;
    } catch { /* cancelled */ }
  }

  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 6000);
}

// ── Common canvas share/download ─────────────────────────────────────────
async function shareCanvas(canvas: HTMLCanvasElement, filename: string, title: string) {
  const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'));
  if (!blob) return;
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return; } catch { /* cancelled */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 6000);
}

// ── Common card scaffolding ───────────────────────────────────────────────
function makeCanvas(totalH: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width  = W * SCALE;
  canvas.height = totalH * SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, totalH);
  return { canvas, ctx };
}

function drawCardHeader(
  ctx: CanvasRenderingContext2D, y: number,
  subTitle: string, badge: string, SANS: string,
): number {
  const H = 66;
  ctx.fillStyle = DIVIDER; ctx.fillRect(0, H - 1, W, 1);
  ctx.fillStyle = GREEN; ctx.font = `bold 16px ${SANS}`; ctx.textBaseline = 'alphabetic';
  ctx.fillText('GB-Driver', PAD, y + 34);
  ctx.fillStyle = GRAY; ctx.font = `12px ${SANS}`;
  ctx.fillText(subTitle, PAD, y + 52);
  ctx.font = `bold 9px ${SANS}`;
  const bW = ctx.measureText(badge).width + 18;
  const bX = W - PAD - bW; const bY = y + 20;
  roundRect(ctx, bX, bY, bW, 18, 9);
  ctx.fillStyle = 'rgba(0,242,96,0.08)'; ctx.fill();
  ctx.strokeStyle = 'rgba(0,242,96,0.28)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = GREEN; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(badge, bX + bW / 2, bY + 9);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  return y + H;
}

function drawCardHero(
  ctx: CanvasRenderingContext2D, y: number,
  lbl: string, income: number, net: number, tips: number, expenses: number,
  SANS: string, MONO: string,
): number {
  const H = 100;
  ctx.fillStyle = DIVIDER; ctx.fillRect(0, y + H - 1, W, 1);
  ctx.fillStyle = GRAY; ctx.font = `10px ${SANS}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(lbl.toUpperCase(), W / 2, y + 20);
  ctx.fillStyle = WHITE; ctx.font = `bold 42px ${MONO}`; ctx.textAlign = 'center';
  ctx.fillText(`฿${Math.round(income)}`, W / 2, y + 62);
  const parts = [`Net ฿${Math.round(net)}`, `Tip ฿${Math.round(tips)}`, `Exp ฿${Math.round(expenses)}`];
  ctx.fillStyle = GRAY; ctx.font = `11px ${SANS}`;
  ctx.fillText(parts.join('  ·  '), W / 2, y + H - 12);
  ctx.textAlign = 'left';
  return y + H;
}

function drawCardStats(
  ctx: CanvasRenderingContext2D, y: number,
  cells: { val: string; lbl: string; sub?: string }[],
  SANS: string, MONO: string,
): number {
  const H = 78;
  ctx.fillStyle = DIVIDER; ctx.fillRect(0, y + H - 1, W, 1);
  const cw = W / cells.length;
  cells.forEach((cell, i) => {
    const cx = cw * i + cw / 2;
    const mid = y + H / 2 - 4;
    if (i > 0) { ctx.fillStyle = DIVIDER; ctx.fillRect(cw * i, y + 14, 1, H - 28); }
    ctx.fillStyle = WHITE; ctx.font = `bold 20px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(cell.val, cx, mid + 4);
    ctx.fillStyle = GRAY; ctx.font = `9px ${SANS}`;
    ctx.fillText(cell.lbl.toUpperCase(), cx, mid + 20);
    if (cell.sub) {
      ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.font = `8px ${MONO}`;
      ctx.fillText(cell.sub, cx, mid + 33);
    }
  });
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  return y + H;
}

function drawCardFooter(ctx: CanvasRenderingContext2D, y: number, SANS: string): void {
  const H = 48;
  ctx.fillStyle = DIVIDER; ctx.fillRect(0, y, W, 1);
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.font = `10px ${SANS}`; ctx.textBaseline = 'middle';
  ctx.fillText('gb-driver.com', PAD, y + H / 2);
  ctx.fillStyle = 'rgba(0,242,96,0.32)'; ctx.font = `bold 12px ${SANS}`; ctx.textAlign = 'right';
  ctx.fillText('GB-Driver', W - PAD, y + H / 2);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

// ── Weekly card ───────────────────────────────────────────────────────────
export async function generateAndShareWeeklyCard(
  weekKey: string,   // YYYY-MM-DD (Monday)
  ss: ShiftSession[],
  lang: 'en' | 'th',
): Promise<void> {
  const totals = computeCardTotals(ss);

  // Group by date
  const dayMap = new Map<string, ShiftSession[]>();
  ss.forEach(s => { if (!dayMap.has(s.date)) dayMap.set(s.date, []); dayMap.get(s.date)!.push(s); });
  const days = [...dayMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const weekStart = parseISO(weekKey);
  const weekEnd   = addDays(weekStart, 6);
  const rangeStr  = format(weekStart, 'MMM d') + ' – ' + format(weekEnd, 'd MMM yyyy');
  const badge     = lang === 'th' ? 'รายสัปดาห์' : 'WEEKLY RECAP';
  const heroLbl   = lang === 'th' ? 'รายรับรวมสัปดาห์ (ไม่รวมทิป)' : 'WEEKLY INCOME (excl. tips)';
  const avgPerDay = days.length > 0 ? totals.income / days.length : 0;

  const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
  const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';

  const SEC_H      = 30;
  const DAY_ROW_H  = 34;
  const PB_H       = totals.tripCount > 0 ? 40 : 0;
  const FOOTER_H   = 48;
  const totalH     = 66 + 100 + 78 + SEC_H + days.length * DAY_ROW_H + PB_H + FOOTER_H;

  const { canvas, ctx } = makeCanvas(totalH);
  let y = 0;

  y = drawCardHeader(ctx, y, rangeStr, badge, SANS);
  y = drawCardHero(ctx, y, heroLbl, totals.income, totals.net, totals.tips, totals.expenses, SANS, MONO);

  const onlineStr = (() => {
    const h = Math.floor(totals.onlineSecs / 3600), m = Math.floor((totals.onlineSecs % 3600) / 60);
    return totals.onlineSecs > 0 ? (h > 0 ? `${h}h ${m}m` : `${m}m`) : '—';
  })();
  y = drawCardStats(ctx, y, [
    { val: totals.tripCount.toString(), lbl: lang === 'th' ? 'รอบทั้งหมด' : 'trips' },
    { val: `${days.length}`, lbl: lang === 'th' ? 'วันทำงาน' : 'active days' },
    { val: `฿${Math.round(avgPerDay)}`, lbl: lang === 'th' ? 'เฉลี่ย/วัน' : 'avg/day', sub: onlineStr },
  ], SANS, MONO);

  // Section label
  ctx.fillStyle = GRAY_DIM; ctx.fillRect(0, y, W, SEC_H);
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.font = `bold 9px ${SANS}`; ctx.textBaseline = 'middle';
  ctx.fillText((lang === 'th' ? 'รายวัน' : 'DAILY BREAKDOWN'), PAD, y + SEC_H / 2);
  ctx.fillStyle = DIVIDER; ctx.fillRect(0, y + SEC_H - 1, W, 1); ctx.textBaseline = 'alphabetic';
  y += SEC_H;

  // Day rows
  days.forEach(([date, daySessions], i) => {
    const dt = computeCardTotals(daySessions);
    const rowY = y + i * DAY_ROW_H;
    if (i % 2 === 0) { ctx.fillStyle = GRAY_DIM; ctx.fillRect(0, rowY, W, DAY_ROW_H); }
    const dayLabel = format(parseISO(date), lang === 'th' ? 'EEE d MMM' : 'EEE, MMM d');
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = `11px ${SANS}`; ctx.textBaseline = 'middle';
    ctx.fillText(dayLabel, PAD + 8, rowY + DAY_ROW_H / 2);
    ctx.fillStyle = GRAY; ctx.font = `10px ${SANS}`; ctx.textAlign = 'center';
    ctx.fillText(`${dt.tripCount} ${lang === 'th' ? 'รอบ' : 'trips'}`, W / 2, rowY + DAY_ROW_H / 2);
    ctx.fillStyle = WHITE; ctx.font = `bold 12px ${MONO}`; ctx.textAlign = 'right';
    ctx.fillText(`฿${Math.round(dt.income)}`, W - PAD, rowY + DAY_ROW_H / 2);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = DIVIDER; ctx.fillRect(PAD, rowY + DAY_ROW_H - 1, W - PAD * 2, 1);
  });
  y += days.length * DAY_ROW_H;

  if (PB_H > 0) { renderPlatformBar(ctx, y, totals.grabNet, totals.boltNet, totals.vipNet, totals.tips, lang, SANS, MONO); y += PB_H; }
  drawCardFooter(ctx, y, SANS);

  await shareCanvas(canvas, `gb-driver-week-${weekKey}.png`, 'GB-Driver Weekly Summary');
}

// ── Monthly card ──────────────────────────────────────────────────────────
export async function generateAndShareMonthlyCard(
  monthKey: string,  // YYYY-MM
  ss: ShiftSession[],
  lang: 'en' | 'th',
): Promise<void> {
  const totals = computeCardTotals(ss);

  // Group by week (Mon-start)
  const weekMap = new Map<string, ShiftSession[]>();
  ss.forEach(s => {
    const ws = format(startOfWeek(parseISO(s.date), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    if (!weekMap.has(ws)) weekMap.set(ws, []);
    weekMap.get(ws)!.push(s);
  });
  const weeks = [...weekMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const activeDays = new Set(ss.map(s => s.date)).size;
  const monthDate  = parseISO(monthKey + '-01');
  const monthLabel = format(monthDate, 'MMMM yyyy');
  const badge      = lang === 'th' ? 'รายเดือน' : 'MONTHLY RECAP';
  const heroLbl    = lang === 'th' ? 'รายรับรวมเดือน (ไม่รวมทิป)' : 'MONTHLY INCOME (excl. tips)';
  const avgPerDay  = activeDays > 0 ? totals.income / activeDays : 0;

  const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
  const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';

  const SEC_H      = 30;
  const WK_ROW_H   = 36;
  const PB_H       = totals.tripCount > 0 ? 40 : 0;
  const FOOTER_H   = 48;
  const totalH     = 66 + 100 + 78 + SEC_H + weeks.length * WK_ROW_H + PB_H + FOOTER_H;

  const { canvas, ctx } = makeCanvas(totalH);
  let y = 0;

  y = drawCardHeader(ctx, y, monthLabel, badge, SANS);
  y = drawCardHero(ctx, y, heroLbl, totals.income, totals.net, totals.tips, totals.expenses, SANS, MONO);
  y = drawCardStats(ctx, y, [
    { val: totals.tripCount.toString(), lbl: lang === 'th' ? 'รอบทั้งหมด' : 'trips' },
    { val: `${activeDays}`, lbl: lang === 'th' ? 'วันทำงาน' : 'active days' },
    { val: `฿${Math.round(avgPerDay)}`, lbl: lang === 'th' ? 'เฉลี่ย/วัน' : 'avg/day' },
  ], SANS, MONO);

  // Section label
  ctx.fillStyle = GRAY_DIM; ctx.fillRect(0, y, W, SEC_H);
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.font = `bold 9px ${SANS}`; ctx.textBaseline = 'middle';
  ctx.fillText((lang === 'th' ? 'รายสัปดาห์' : 'WEEKLY BREAKDOWN'), PAD, y + SEC_H / 2);
  ctx.fillStyle = DIVIDER; ctx.fillRect(0, y + SEC_H - 1, W, 1); ctx.textBaseline = 'alphabetic';
  y += SEC_H;

  // Week rows
  weeks.forEach(([wk, wkSessions], i) => {
    const wt     = computeCardTotals(wkSessions);
    const rowY   = y + i * WK_ROW_H;
    const wStart = parseISO(wk);
    const wEnd   = addDays(wStart, 6);
    const wLabel = format(wStart, 'MMM d') + '–' + format(wEnd, 'd');
    if (i % 2 === 0) { ctx.fillStyle = GRAY_DIM; ctx.fillRect(0, rowY, W, WK_ROW_H); }
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = `11px ${SANS}`; ctx.textBaseline = 'middle';
    ctx.fillText(wLabel, PAD + 8, rowY + WK_ROW_H / 2);
    ctx.fillStyle = GRAY; ctx.font = `10px ${SANS}`; ctx.textAlign = 'center';
    ctx.fillText(`${wt.tripCount} ${lang === 'th' ? 'รอบ' : 'trips'}`, W / 2, rowY + WK_ROW_H / 2);
    ctx.fillStyle = WHITE; ctx.font = `bold 12px ${MONO}`; ctx.textAlign = 'right';
    ctx.fillText(`฿${Math.round(wt.income)}`, W - PAD, rowY + WK_ROW_H / 2);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = DIVIDER; ctx.fillRect(PAD, rowY + WK_ROW_H - 1, W - PAD * 2, 1);
  });
  y += weeks.length * WK_ROW_H;

  if (PB_H > 0) { renderPlatformBar(ctx, y, totals.grabNet, totals.boltNet, totals.vipNet, totals.tips, lang, SANS, MONO); y += PB_H; }
  drawCardFooter(ctx, y, SANS);

  await shareCanvas(canvas, `gb-driver-${monthKey}.png`, 'GB-Driver Monthly Summary');
}
