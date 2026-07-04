// Generación client-side de la credencial en PNG.
// Canvas puro, sin dependencias externas. Estilo horizontal tipo tarjeta
// (1200×675, ratio 16:9). Editorial, coherente con la identidad D³:
// fondo papel, tipografía Georgia, acento coral.

export interface CredentialPngPayload {
  publicId: string;
  createdAtISO: string | null;
  discoveredCount: number;
  familiesCompleted: number;
  claims: Array<{ claim_code: string; reward_name: string; family_name?: string | null }>;
}

const W = 1200;
const H = 675;
const PAD = 56;
const PAPER = '#f4f1ea';
const INK = '#171411';
const INK_SOFT = '#544c45';
const ACCENT = '#d9485f';
const CARD_BORDER = 'rgba(17,17,17,0.82)';

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  font: string, color: string, align: CanvasTextAlign = 'left',
) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
}

/**
 * Renderiza la credencial y descarga el PNG. Devuelve true en éxito.
 */
export async function downloadCredentialPng(payload: CredentialPngPayload): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  // Fondo papel
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  // Trazos de cuaderno (líneas horizontales tenues)
  ctx.strokeStyle = 'rgba(17,17,17,0.06)';
  ctx.lineWidth = 1;
  for (let y = 60; y < H; y += 42) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Regla vertical roja (identidad del sitio)
  ctx.fillStyle = ACCENT;
  ctx.fillRect(38, PAD, 4, H - PAD * 2);

  // Marco de la tarjeta (borde interno tipo paper-card)
  ctx.strokeStyle = CARD_BORDER;
  ctx.lineWidth = 3;
  ctx.strokeRect(PAD + 22, PAD, W - PAD * 2 - 22, H - PAD * 2);

  // Sombra de la tarjeta
  ctx.fillStyle = 'rgba(17,17,17,0.10)';
  ctx.fillRect(PAD + 26, PAD + 4, W - PAD * 2 - 22, H - PAD * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.fillRect(PAD + 22, PAD, W - PAD * 2 - 22, H - PAD * 2);
  ctx.strokeRect(PAD + 22, PAD, W - PAD * 2 - 22, H - PAD * 2);

  // Cabecera
  const contentX = PAD + 48;
  let cursorY = PAD + 46;

  drawText(ctx, 'TINTA · ESTUVO AQUÍ', contentX, cursorY,
    'bold 20px "Trebuchet MS", "Segoe UI", sans-serif', ACCENT);
  cursorY += 24;
  ctx.letterSpacing = '0em';

  drawText(ctx, 'Credencial de explorador', contentX, cursorY + 26,
    '52px Georgia, "Times New Roman", serif', INK);
  cursorY += 60;

  drawText(ctx, '"guarda esto: es tu manera de volver."',
    contentX, cursorY + 34,
    'italic 22px Georgia, serif', INK_SOFT);
  cursorY += 60;

  // Imagen de Tinta (columna derecha)
  const tinta = await loadImage('/images/ui/tinta_lapiz.png');
  if (tinta) {
    const imgW = 260;
    const imgH = (tinta.height / tinta.width) * imgW;
    const imgX = W - PAD - 48 - imgW;
    const imgY = PAD + 100;
    ctx.save();
    ctx.translate(imgX + imgW / 2, imgY + imgH / 2);
    ctx.rotate(-3 * Math.PI / 180);
    ctx.drawImage(tinta, -imgW / 2, -imgH / 2, imgW, imgH);
    ctx.restore();
  }

  // Bloque de datos (columna izquierda)
  const dataX = contentX;
  const valueX = dataX + 340;
  let rowY = PAD + 220;

  const row = (label: string, value: string, color = INK) => {
    drawText(ctx, label.toUpperCase(), dataX, rowY,
      'bold 14px "Trebuchet MS", sans-serif', INK_SOFT);
    drawText(ctx, value, valueX, rowY, '24px Georgia, serif', color);
    ctx.strokeStyle = 'rgba(17,17,17,0.16)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(dataX, rowY + 10);
    ctx.lineTo(valueX + 260, rowY + 10);
    ctx.stroke();
    ctx.setLineDash([]);
    rowY += 44;
  };

  row('ID público', payload.publicId, INK);
  const created = payload.createdAtISO
    ? new Date(payload.createdAtISO).toLocaleDateString()
    : '—';
  row('Fecha de unión', created);
  row('Nodos encontrados', String(payload.discoveredCount));
  row('Familias completadas', String(payload.familiesCompleted));

  // Claim principal (si existe)
  const firstClaim = payload.claims[0];
  if (firstClaim) {
    rowY += 8;
    drawText(ctx, 'CÓDIGO DE RECLAMO', dataX, rowY,
      'bold 14px "Trebuchet MS", sans-serif', ACCENT);
    rowY += 34;
    drawText(ctx, firstClaim.claim_code, dataX, rowY,
      'bold 34px Georgia, serif', ACCENT);
    rowY += 30;
    drawText(ctx, firstClaim.reward_name, dataX, rowY,
      'italic 18px Georgia, serif', INK_SOFT);
  }

  // Footer
  drawText(ctx, 'Domingos de Dibujar · Tinta estuvo aquí',
    PAD + 48, H - PAD - 16,
    'italic 15px Georgia, serif', INK_SOFT);
  drawText(ctx, 'domingosdedibujar.netlify.app/tinta/tintamap/credencial',
    W - PAD - 48, H - PAD - 16,
    '14px "Trebuchet MS", sans-serif', INK_SOFT, 'right');

  // Descargar
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `credencial-${payload.publicId}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}
