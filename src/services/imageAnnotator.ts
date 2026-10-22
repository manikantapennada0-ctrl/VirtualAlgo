import { DetectedObject, DetectionMode } from '../types';

const COLOR_PALETTE = [
  '#00e5ff', // Electric Cyan
  '#00e676', // Emerald Green
  '#ff1744', // Bright Crimson
  '#ffab00', // Electric Amber
  '#d500f9', // Vivid Purple
  '#2979ff', // Deep Sky Blue
];
const COLOR_SECONDARY = '#71717a'; // Muted slate gray

export async function renderAnnotatedImage(
  imageSource: string | File | Blob,
  objects: DetectedObject[],
  mode: DetectionMode
): Promise<{ annotatedDataUrl: string; width: number; height: number }> {
  const img = await loadImage(imageSource);
  const canvas = document.createElement('canvas');
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    throw new Error('Canvas 2D context not available');
  }

  // Draw base image
  ctx.drawImage(img, 0, 0, w, h);

  // Render every detected object so all boxes and labels are prominently visible
  const allObjects = objects;

  allObjects.forEach((obj, idx) => {
    const isRelevant = obj.is_relevant !== false;
    const color = obj.color_hex || COLOR_PALETTE[idx % COLOR_PALETTE.length];
    obj.color_hex = color;

    // Ensure safe box coordinates
    let norm = Array.isArray(obj.box_norm) && obj.box_norm.length === 4
      ? obj.box_norm
      : [200, 200, 800, 800];

    let ymin = Math.min(norm[0], norm[2]);
    let ymax = Math.max(norm[0], norm[2]);
    let xmin = Math.min(norm[1], norm[3]);
    let xmax = Math.max(norm[1], norm[3]);

    let x1 = Math.round((xmin / 1000) * w);
    let y1 = Math.round((ymin / 1000) * h);
    let x2 = Math.round((xmax / 1000) * w);
    let y2 = Math.round((ymax / 1000) * h);

    if (x2 <= x1 + 10) x2 = Math.min(w, x1 + 40);
    if (y2 <= y1 + 10) y2 = Math.min(h, y1 + 40);

    const bw = x2 - x1;
    const bh = y2 - y1;

    const thickness = Math.max(3, Math.round(Math.min(w, h) * 0.005));

    // 1. Subtle colored tint over the object area so it stands out
    ctx.fillStyle = `${color}18`;
    ctx.fillRect(x1, y1, bw, bh);

    // 2. Main bounding box with glow
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.strokeRect(x1, y1, bw, bh);
    ctx.restore();

    // 3. High-tech corner bracket accents
    const cornerLen = Math.max(14, Math.round(Math.min(bw, bh) * 0.18));
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness + 3;

    ctx.beginPath();
    // Top-left
    ctx.moveTo(x1, y1 + cornerLen);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x1 + cornerLen, y1);
    // Top-right
    ctx.moveTo(x2 - cornerLen, y1);
    ctx.lineTo(x2, y1);
    ctx.lineTo(x2, y1 + cornerLen);
    // Bottom-left
    ctx.moveTo(x1, y2 - cornerLen);
    ctx.lineTo(x1, y2);
    ctx.lineTo(x1 + cornerLen, y2);
    // Bottom-right
    ctx.moveTo(x2 - cornerLen, y2);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x2, y2 - cornerLen);
    ctx.stroke();

    // 4. Prominent Label Badge
    const confPct = Math.round(obj.confidence * 100);
    const labelText = obj.confidence > 0 ? `${obj.label} (${confPct}%)` : obj.label;

    const fontSize = Math.max(13, Math.round(Math.min(w, h) * 0.026));
    ctx.font = `800 ${fontSize}px "Plus Jakarta Sans", "Space Grotesk", sans-serif`;

    const metrics = ctx.measureText(labelText);
    const textW = metrics.width;
    const textH = fontSize;

    const badgePadX = 10;
    const badgePadY = 6;
    const badgeW = textW + badgePadX * 2;
    const badgeH = textH + badgePadY * 2;

    const badgeY = y1 - badgeH >= 0 ? y1 - badgeH : y1;
    const badgeX = Math.min(x1, Math.max(0, w - badgeW));

    // Badge shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(badgeX + 2, badgeY + 2, badgeW, badgeH);

    // Badge solid background
    ctx.fillStyle = color;
    ctx.fillRect(badgeX, badgeY, badgeW, badgeH);

    // Contrasting text color
    ctx.fillStyle = getContrastTextColor(color);
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, badgeX + badgePadX, badgeY + badgeH / 2);
  });

  return {
    annotatedDataUrl: canvas.toDataURL('image/jpeg', 0.88),
    width: w,
    height: h,
  };
}

function loadImage(source: string | File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Failed to load image for rendering: ' + e));

    if (typeof source === 'string') {
      img.src = source;
    } else {
      img.src = URL.createObjectURL(source);
    }
  });
}

function getContrastTextColor(hexColor: string): string {
  // Convert hex to rgb
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? '#000000' : '#ffffff';
}
