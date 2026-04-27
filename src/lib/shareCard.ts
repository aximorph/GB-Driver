/**
 * shareCard.ts
 * Generates a portrait share-card image (Canvas API, no external deps)
 * then downloads it or opens native share sheet.
 */
import { format } from 'date-fns';
import { ShiftSession } from './types';

// ── Palette ───────────────────────────────────────────────────────────────────
const BG       = '#0a0f0a';
const GREEN    = '#00f260';
const VIOLET   = '#8b5cf6';
const WHITE    = '#ffffff';
const GRAY     = 'rgba(255,255,255,0.38)';
const GRAY_DIM = 'rgba(255,255,255,0.07)';
const YELLOW   = '#fbbf24';
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

  // Stats
  const gross    = incomeTrips.reduce((s, e) => s + (e.driverNet || 0), 0);
  const tips     = incomeTrips.reduce((s, e) => s + (e.tip    || 0), 0);
  const bonusAmt = bonuses.reduce((s, e) => s + (e.driverNet || 0), 0);
  const expenses = allEntries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  const income   = gross + tips + bonusAmt;   // hero — total income received
  const net      = income - expenses;

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

  // Avg trip duration
  const withDur    = incomeTrips.filter(e => (e.tripDuration ?? 0) > 0);
  const avgDurSecs = withDur.length > 0
    ? Math.round(withDur.reduce((s, e) => s + (e.tripDuration ?? 0), 0) / withDur.length)
    : 0;
  const avgDurStr = avgDurSecs > 0 ? fmtDur(avgDurSecs) : '—';

  // Trips sorted by (driverNet + tip) DESC, top 5
  const sortedTrips = [...incomeTrips]
    .sort((a, b) => ((b.driverNet || 0) + (b.tip || 0)) - ((a.driverNet || 0) + (a.tip || 0)))
    .slice(0, 5);
  const extraTrips = Math.max(0, tripCount - 5);

  // ── Layout heights ──────────────────────────────────────────────────────────
  const HEADER_H  = 66;
  const HERO_H    = 110;
  const STATS_H   = 80;
  const SEC_LBL_H = 34;
  const TRIP_H    = 44;
  const MORE_H    = extraTrips > 0 ? 32 : 0;
  const FOOTER_H  = 48;

  const totalH = HEADER_H + HERO_H + STATS_H + SEC_LBL_H
    + sortedTrips.length * TRIP_H + MORE_H + FOOTER_H;

  // ── Canvas setup ────────────────────────────────────────────────────────────
  const canvas    = document.createElement('canvas');
  canvas.width    = W     * SCALE;
  canvas.height   = totalH * SCALE;
  const ctx       = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, totalH);

  const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
  const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';

  let y = 0;

  // ── HEADER ──────────────────────────────────────────────────────────────────
  ctx.fillStyle = DIVIDER;
  ctx.fillRect(0, HEADER_H - 1, W, 1);

  ctx.fillStyle = GREEN;
  ctx.font      = `bold 16px ${SANS}`;
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
  const bW   = ctx.measureText(BADGE).width + 18;
  const bX   = W - PAD - bW;
  const bY   = y + 20;

  roundRect(ctx, bX, bY, bW, 18, 9);
  ctx.fillStyle = 'rgba(0,242,96,0.08)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,242,96,0.28)';
  ctx.lineWidth   = 1;
  ctx.stroke();

  ctx.fillStyle    = GREEN;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(BADGE, bX + bW / 2, bY + 9);
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'alphabetic';

  y += HEADER_H;

  // ── HERO ─────────────────────────────────────────────────────────────────────
  ctx.fillStyle = DIVIDER;
  ctx.fillRect(0, y + HERO_H - 1, W, 1);

  const INCOME_LBL = lang === 'th' ? 'รายรับ' : 'INCOME';
  ctx.fillStyle    = GRAY;
  ctx.font         = `11px ${SANS}`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(INCOME_LBL.toUpperCase(), W / 2, y + 22);

  ctx.fillStyle    = WHITE;
  ctx.font         = `bold 46px ${MONO}`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`฿${Math.round(income)}`, W / 2, y + 70);

  // Sub row
  const netLbl = lang === 'th' ? 'สุทธิ' : 'Net';
  const tipLbl = lang === 'th' ? 'ทิป' : 'Tip';
  const expLbl = lang === 'th' ? 'รายจ่าย' : 'Exp';
  const subParts = [
    `${netLbl} ฿${Math.round(net)}`,
    `${tipLbl} ฿${Math.round(tips)}`,
    `${expLbl} ฿${Math.round(expenses)}`,
  ];
  const subStr  = subParts.join('  ·  ');
  ctx.fillStyle = GRAY;
  ctx.font      = `11px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.fillText(subStr, W / 2, y + HERO_H - 18);
  ctx.textAlign = 'left';

  y += HERO_H;

  // ── STATS ────────────────────────────────────────────────────────────────────
  ctx.fillStyle = DIVIDER;
  ctx.fillRect(0, y + STATS_H - 1, W, 1);

  const statCells = [
    { val: tripCount.toString(),  lbl: lang === 'th' ? 'รอบทั้งหมด' : 'trips' },
    { val: onlineStr,              lbl: lang === 'th' ? 'ออนไลน์' : 'online' },
    { val: avgDurStr,              lbl: lang === 'th' ? 'เฉลี่ย/รอบ' : 'avg/trip' },
  ];
  const cellW = W / 3;

  statCells.forEach((cell, i) => {
    const cx  = cellW * i + cellW / 2;
    const mid = y + STATS_H / 2;

    if (i > 0) {
      ctx.fillStyle = DIVIDER;
      ctx.fillRect(cellW * i, y + 14, 1, STATS_H - 28);
    }

    ctx.fillStyle    = WHITE;
    ctx.font         = `bold 20px ${MONO}`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(cell.val, cx, mid + 4);

    ctx.fillStyle = GRAY;
    ctx.font      = `9px ${SANS}`;
    ctx.fillText(cell.lbl.toUpperCase(), cx, mid + 22);
  });

  ctx.textAlign    = 'left';
  ctx.textBaseline = 'alphabetic';
  y += STATS_H;

  // ── SECTION LABEL ────────────────────────────────────────────────────────────
  const secLbl = lang === 'th'
    ? `รายการ (เรียงตามยอด) · ${Math.min(tripCount, 5)}/${tripCount}`
    : `Trips by amount · ${Math.min(tripCount, 5)} of ${tripCount}`;
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.font      = `bold 9px ${SANS}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(secLbl.toUpperCase(), PAD, y + SEC_LBL_H / 2);
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = DIVIDER;
  ctx.fillRect(0, y + SEC_LBL_H - 1, W, 1);
  y += SEC_LBL_H;

  // ── TRIP LIST ────────────────────────────────────────────────────────────────
  sortedTrips.forEach((e, i) => {
    const rowY  = y + i * TRIP_H;
    const rowMid = rowY + TRIP_H / 2;

    // Alt row bg
    if (i % 2 === 0) {
      ctx.fillStyle = GRAY_DIM;
      ctx.fillRect(0, rowY, W, TRIP_H);
    }

    // Platform dot
    ctx.beginPath();
    ctx.arc(PAD + 5, rowMid, 4, 0, Math.PI * 2);
    ctx.fillStyle = e.platform === 'bolt' ? VIOLET : GREEN;
    ctx.fill();

    // Platform name
    const platName  = e.platform === 'bolt' ? 'Bolt' : 'Grab';
    const orderName = e.orderType === 'express'
      ? (lang === 'th' ? 'ส่งของ' : 'Express')
      : (lang === 'th' ? 'แท็กซี่' : 'Taxi');

    ctx.fillStyle    = e.platform === 'bolt' ? VIOLET : GREEN;
    ctx.font         = `bold 11px ${SANS}`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(platName, PAD + 14, rowMid - 3);

    const platW = ctx.measureText(platName).width;
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font      = `11px ${SANS}`;
    ctx.fillText(` · ${orderName}`, PAD + 14 + platW, rowMid - 3);

    // Time
    const timeStr = format(new Date(e.timestamp), 'HH:mm');
    ctx.fillStyle = GRAY;
    ctx.font      = `10px ${MONO}`;
    ctx.fillText(timeStr, PAD + 14, rowMid + 14);

    // Trip duration
    if (e.tripDuration && e.tripDuration > 0) {
      const tw       = ctx.measureText(timeStr).width;
      const durStr   = `  ⏱ ${fmtDur(e.tripDuration)}`;
      ctx.fillStyle  = 'rgba(0,242,96,0.55)';
      ctx.font       = `bold 10px ${MONO}`;
      ctx.fillText(durStr, PAD + 14 + tw, rowMid + 14);
    }

    // Amount (right)
    const hasTip  = (e.tip ?? 0) > 0;
    const amtVal  = (e.driverNet || 0) + (e.tip || 0);
    const amtStr  = `฿${Math.round(amtVal)}`;
    ctx.fillStyle = WHITE;
    ctx.font      = `bold 13px ${MONO}`;
    const amtW    = ctx.measureText(amtStr).width;
    ctx.fillText(amtStr, W - PAD - amtW, hasTip ? rowMid - 3 : rowMid + 5);

    if (hasTip) {
      const tipStr = `+฿${Math.round(e.tip!)} tip`;
      ctx.fillStyle = YELLOW;
      ctx.font      = `9px ${MONO}`;
      const tipW    = ctx.measureText(tipStr).width;
      ctx.fillText(tipStr, W - PAD - tipW, rowMid + 14);
    }

    // Row divider
    ctx.fillStyle = DIVIDER;
    ctx.fillRect(PAD, rowY + TRIP_H - 1, W - PAD * 2, 1);
  });

  y += sortedTrips.length * TRIP_H;

  // ── "More" row ───────────────────────────────────────────────────────────────
  if (extraTrips > 0) {
    const moreStr = lang === 'th'
      ? `· · · และอีก ${extraTrips} รอบ · · ·`
      : `· · · and ${extraTrips} more trips · · ·`;
    ctx.fillStyle    = GRAY;
    ctx.font         = `10px ${SANS}`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(moreStr, W / 2, y + MORE_H / 2);
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';
    y += MORE_H;
  }

  // ── FOOTER ───────────────────────────────────────────────────────────────────
  ctx.fillStyle = DIVIDER;
  ctx.fillRect(0, y, W, 1);

  ctx.fillStyle    = 'rgba(255,255,255,0.18)';
  ctx.font         = `10px ${SANS}`;
  ctx.textBaseline = 'middle';
  ctx.fillText('gb-driver.pages.dev', PAD, y + FOOTER_H / 2);

  ctx.fillStyle = 'rgba(0,242,96,0.32)';
  ctx.font      = `bold 12px ${SANS}`;
  ctx.textAlign = 'right';
  ctx.fillText('GB-Driver', W - PAD, y + FOOTER_H / 2);
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'alphabetic';

  // ── Share / Download ──────────────────────────────────────────────────────────
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

  // Fallback: download
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 6000);
}
