// Draws the schedule picture on its own canvas — never a screenshot of the page, so no app chrome
// (dog photos, buttons, hours panel) can end up in what workers receive.
import { wrapText, type ImageModel } from '../model/image';

const WIDTH = 1100;
const SCALE = 2;
const PAD = 24;
const NAME_W = 150;
const GAP = 4;
const FONT = 'Calibri, Carlito, Arial, sans-serif';
const INK = '#1a1a1a';

export function renderScheduleImage(model: ImageModel): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const measureCtx = canvas.getContext('2d')!;
  const colW = (WIDTH - PAD * 2 - NAME_W - GAP * 7) / 7;
  const venueFont = `bold 12px ${FONT}`;
  const timeFont = `bold 15px ${FONT}`;
  const measure = (font: string) => (s: string) => { measureCtx.font = font; return measureCtx.measureText(s).width; };

  // Lay out every row first so the canvas can be sized to fit.
  const rows = model.rows.map((r) => {
    const cells = r.cells.map((c) => (c.kind === 'shift' && c.venue ? wrapText(c.venue, colW - 10, measure(venueFont)) : []));
    const venueLines = Math.max(0, ...cells.map((l) => l.length));
    return { row: r, venueLines: cells, height: Math.max(50, 16 + venueLines * 14 + 18) };
  });
  const titleH = 44;
  const headH = 40;
  const height = PAD + titleH + headH + rows.reduce((s, r) => s + r.height + GAP, 0) + PAD - GAP;

  canvas.width = WIDTH * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, WIDTH, height);
  ctx.textBaseline = 'middle';

  ctx.fillStyle = INK;
  ctx.font = `bold 26px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(model.title, PAD, PAD + 16);

  const colX = (i: number) => PAD + NAME_W + GAP + i * (colW + GAP);
  let y = PAD + titleH;
  ctx.textAlign = 'center';
  model.days.forEach((d, i) => {
    const cx = colX(i) + colW / 2;
    ctx.fillStyle = '#444';
    ctx.font = `bold 14px ${FONT}`;
    ctx.fillText(d.day, cx, y + 12);
    ctx.font = `13px ${FONT}`;
    ctx.fillText(d.date, cx, y + 29);
  });
  y += headH;

  rows.forEach(({ row, venueLines, height: h }, ri) => {
    if (ri % 2 === 1) {
      ctx.fillStyle = '#f4f4f4';
      roundRect(ctx, PAD, y, WIDTH - PAD * 2, h, 6);
      ctx.fill();
    }
    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    ctx.font = `bold 16px ${FONT}`;
    ctx.fillText(fit(ctx, row.name, NAME_W - 12), PAD + 8, y + h / 2);

    ctx.textAlign = 'center';
    row.cells.forEach((c, i) => {
      if (c.kind === 'empty') return;
      const x = colX(i);
      const cx = x + colW / 2;
      if (c.kind === 'day') {
        ctx.fillStyle = '#333333';
        roundRect(ctx, x, y + 2, colW, h - 4, 6);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = timeFont;
        ctx.fillText(c.time, cx, y + h / 2);
        return;
      }
      ctx.fillStyle = c.color;
      roundRect(ctx, x, y + 2, colW, h - 4, 6);
      ctx.fill();
      if (!c.venue) {
        ctx.strokeStyle = '#999';
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      const lines = venueLines[i];
      const blockH = lines.length * 14 + 18;
      let ty = y + (h - blockH) / 2 + 7;
      ctx.fillStyle = INK;
      ctx.font = venueFont;
      for (const line of lines) { ctx.fillText(line, cx, ty); ty += 14; }
      ctx.font = timeFont;
      ctx.fillText(c.time, cx, ty + 4);
    });
    y += h + GAP;
  });

  return canvas;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Shortens a name that's too long for the name column with an ellipsis (names only — venues always wrap). */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

export async function downloadScheduleImage(model: ImageModel, fileName: string): Promise<void> {
  await document.fonts?.ready;
  const canvas = renderScheduleImage(model);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
