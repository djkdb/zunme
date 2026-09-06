/**
 * Shareable result card (1080×1080 PNG) drawn with Canvas 2D — no fonts or
 * assets to load, so it works offline and on every phone that can share files.
 */
export interface ResultCardInput {
  headline: string;
  modeLabel: string;
  winner: { name: string; color: string } | null;
  rows: { name: string; color: string; detail: string; me: boolean }[];
  moments: string[];
  footer: string;
  seriesLine?: string;
}

const W = 1080;
const H = 1080;
const FONT = '"Rubik", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > max) t = t.slice(0, -1);
  return t + "…";
}

export async function renderResultCard(input: ResultCardInput): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");

  // background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#1c2a6b");
  bg.addColorStop(1, "#12142b");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.75, 120, 0, W * 0.75, 120, 520);
  glow.addColorStop(0, "rgba(255,211,42,0.35)");
  glow.addColorStop(1, "rgba(255,211,42,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // logo
  ctx.textBaseline = "top";
  ctx.font = `900 84px ${FONT}`;
  const lg = ctx.createLinearGradient(70, 0, 420, 0);
  lg.addColorStop(0, "#ffd32a");
  lg.addColorStop(1, "#ff6bcb");
  ctx.fillStyle = lg;
  ctx.fillText("ZUUUN", 70, 60);
  ctx.font = `800 30px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText(input.modeLabel, 74, 160);
  if (input.seriesLine) {
    ctx.fillStyle = "#ffd32a";
    ctx.fillText(input.seriesLine, 74, 204);
  }

  // headline + winner
  ctx.font = `900 64px ${FONT}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(fit(ctx, input.headline, W - 140), 70, 262);
  if (input.winner) {
    ctx.font = `900 96px ${FONT}`;
    ctx.fillStyle = input.winner.color;
    ctx.fillText(fit(ctx, input.winner.name, W - 140), 70, 340);
  }

  // ranking rows
  let y = input.winner ? 480 : 380;
  const rowH = 72;
  const medals = ["🥇", "🥈", "🥉"];
  const rows = input.rows.slice(0, 6);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    roundRect(ctx, 70, y, W - 140, rowH - 10, 22);
    ctx.fillStyle = r.me ? "rgba(255,211,42,0.18)" : "rgba(255,255,255,0.08)";
    ctx.fill();
    ctx.font = `800 34px ${FONT}`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(medals[i] ?? `${i + 1}.`, 96, y + 14);
    ctx.fillStyle = r.color;
    ctx.beginPath();
    ctx.arc(190, y + 31, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(fit(ctx, r.name + (r.me ? " (나)" : ""), 480), 222, y + 14);
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = `700 30px ${FONT}`;
    ctx.fillText(r.detail, W - 100, y + 16);
    ctx.textAlign = "left";
    y += rowH;
  }

  // moments
  y += 16;
  ctx.font = `800 32px ${FONT}`;
  for (const m of input.moments.slice(0, 2)) {
    const w = ctx.measureText(m).width + 48;
    roundRect(ctx, 70, y, Math.min(W - 140, w), 56, 28);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(fit(ctx, m, W - 190), 94, y + 11);
    y += 68;
  }

  // footer
  ctx.font = `800 30px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText(fit(ctx, input.footer, W - 140), 70, H - 90);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"));
}

/** Share the card via the native sheet (as a file) or fall back to opening it in a new tab. */
export async function shareResultCard(input: ResultCardInput, text: string, url: string): Promise<"shared" | "opened" | "failed"> {
  let blob: Blob;
  try {
    blob = await renderResultCard(input);
  } catch {
    return "failed";
  }
  const file = new File([blob], "zuuun-result.png", { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: "ZUUUN", text: `${text}\n${url}` });
      return "shared";
    } catch {
      /* cancelled */
    }
  }
  try {
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = "zuuun-result.png";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
    return "opened";
  } catch {
    return "failed";
  }
}
