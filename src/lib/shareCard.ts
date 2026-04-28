/**
 * shareCard.ts
 * Generates a portrait share-card image (Canvas API, no external deps)
 * then downloads it or opens native share sheet.
 */
import { format } from 'date-fns';
import { ShiftSession, Entry } from './types';

// ── Palette ───────────────────────────────────────────────────────────────────
const BG       = '#0a0f0a';
const GREEN    = '#00f260';
const VIOLET   = '#8b5cf6';
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

  // ── Platform split ────────────────────────────────────────────────────────
  const grabAll = [...incomeTrips].filter(e => e.platform !== 'bolt').sort(byNetDesc);
  const boltAll = [...incomeTrips].filter(e => e.platform === 'bolt').sort(byNetDesc);

  const hasBoth = grabAll.length > 0 && boltAll.length > 0;

  // Top 5 displayed per platform
  const grabRows  = grabAll.slice(0, 5);
  const boltRows  = boltAll.slice(0, 5);
  const grabExtra = Math.max(0, grabAll.length - 5);
  const boltExtra = Math.max(0, boltAll.length - 5);

  // Subtotals (driverNet only — tips shown separately)
  const grabSubtotal = grabAll.reduce((s, e) => s + (e.driverNet || 0), 0);
  const boltSubtotal = boltAll.reduce((s, e) => s + (e.driverNet || 0), 0);
  const grabTips     = grabAll.reduce((s, e) => s + (e.tip || 0), 0);
  const boltTips     = boltAll.reduce((s, e) => s + (e.tip || 0), 0);

  // For single-platform fallback
  const singleRows     = hasBoth ? [] : (grabRows.length ? grabRows : boltRows);
  const singleExtra    = hasBoth ? 0  : (grabExtra || boltExtra);
  const singleSubtotal = hasBoth ? 0  : (grabSubtotal || boltSubtotal);
  const singleTips     = hasBoth ? 0  : (grabTips || boltTips);
  const singleColor    = hasBoth ? GREEN : (grabAll.length ? GREEN : VIOLET);

  // Tip subtotal rows (only drawn when tips > 0)
  const TIP_SUBTOTAL_H = 26;
  const hasDualTips   = hasBoth && (grabTips > 0 || boltTips > 0);
  const hasSingleTips = !hasBoth && singleTips > 0;
  const tipSubtotalH  = (hasDualTips || hasSingleTips) ? TIP_SUBTOTAL_H : 0;

  // ── Layout constants ──────────────────────────────────────────────────────
  const HEADER_H   = 66;
  const HERO_H     = 110;
  const STATS_H    = 88;   // slightly taller to fit time-range sub-label
  const SUBTOTAL_H = 38;
  const FOOTER_H   = 48;

  // Dual-platform section heights
  const COL_HDR_H  = 32;
  const TRIP_H_D   = 42;   // slightly taller to fit tip line
  const MORE_H_D   = (hasBoth && (grabExtra > 0 || boltExtra > 0)) ? 26 : 0;
  const dualRows   = Math.max(grabRows.length, boltRows.length);

  // Single-platform section heights
  const SEC_LBL_H = 34;
  const TRIP_H_S  = 46;   // slightly taller to fit tip line
  const MORE_H_S  = (!hasBoth && singleExtra > 0) ? 32 : 0;

  const tripSection = hasBoth
    ? COL_HDR_H + dualRows * TRIP_H_D + MORE_H_D + SUBTOTAL_H + tipSubtotalH
    : SEC_LBL_H + singleRows.length * TRIP_H_S + MORE_H_S + SUBTOTAL_H + tipSubtotalH;

  const totalH = HEADER_H + HERO_H + STATS_H + tripSection + FOOTER_H;

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
    const cx  = cellW * i + cellW / 2;
    const mid = y + STATS_H / 2 - 4;
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
  });
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'alphabetic';
  y += STATS_H;

  // ── TRIP SECTION ──────────────────────────────────────────────────────────
  if (hasBoth) {
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

    drawColHeader('Grab', grabAll.length, L0, L1, GREEN);
    drawColHeader('Bolt', boltAll.length, R0, R1, VIOLET);

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
      drawDualRow(grabRows[i] ?? null, rowY, TRIP_H_D, L0, L1, GREEN,  isAlt);
      drawDualRow(boltRows[i] ?? null, rowY, TRIP_H_D, R0, R1, VIOLET, isAlt);
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
      drawMore(grabExtra, L0, L1);
      drawMore(boltExtra, R0, R1);
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
    drawSubtotal(grabSubtotal, L0, L1, GREEN);
    drawSubtotal(boltSubtotal, R0, R1, VIOLET);
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
      drawTipSubtotal(grabTips, L0, L1);
      drawTipSubtotal(boltTips, R0, R1);
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
      const platName = grabAll.length ? 'Grab' : 'Bolt';
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
