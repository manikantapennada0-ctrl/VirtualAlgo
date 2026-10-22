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

  // Filter objects based on mode
  let filtered = objects;
  if (mode === 'task_focused') {
    const relevantOnly = objects.filter((o) => o.is_relevant);
    if (relevantOnly.length > 0) {
      filtered = relevantOnly;
    }
  }

  // Draw boxes and corner brackets
  filtered.forEach((obj, idx) => {
    const isRelevant = obj.is_relevant;
    const color = isRelevant
      ? COLOR_PALETTE[idx % COLOR_PALETTE.length]
      : COLOR_SECONDARY;

    const [ymin, xmin, ymax, xmax] = obj.box_norm;
    let x1 = Math.round((xmin / 1000) * w);
    let y1 = Math.round((ymin / 1000) * h);
    let x2 = Math.round((xmax / 1000) * w);
    let y2 = Math.round((ymax / 1000) * h);

    if (x2 <= x1 + 4) x2 = Math.min(w, x1 + 24);
    if (y2 <= y1 + 4) y2 = Math.min(h, y1 + 24);

    const bw = x2 - x1;
    const bh = y2 - y1;

    const baseThickness = Math.max(2, Math.round(Math.min(w, h) * 0.004));
    const thickness = isRelevant
      ? baseThickness
      : mode === 'hybrid'
      ? Math.max(1, Math.round(baseThickness * 0.6))
      : 1;

    // 1. Main bounding box
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.strokeRect(x1, y1, bw, bh);

    // 2. Corner bracket accents for high-tech OpenCV look
    const cornerLen = Math.max(10, Math.round(Math.min(bw, bh) * 0.16));
    const cornerThickness = thickness + 2;
    ctx.lineWidth = cornerThickness;

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

    // 3. Label Badge
    const confPct = Math.round(obj.confidence * 100);
    const labelText = obj.confidence > 0 ? `${obj.label} (${confPct}%)` : obj.label;

    const fontSize = Math.max(12, Math.round(Math.min(w, h) * 0.024));
    ctx.font = `600 ${fontSize}px "Plus Jakarta Sans", -apple-system, sans-serif`;

    const metrics = ctx.measureText(labelText);
    const textW = metrics.width;
    const textH = fontSize;

    const badgePadX = 8;
    const badgePadY = 5;
    const badgeW = textW + badgePadX * 2;
    const badgeH = textH + badgePadY * 2;

    const badgeY = y1 - badgeH >= 0 ? y1 - badgeH : y1;
    const badgeX = Math.min(x1, Math.max(0, w - badgeW));

    // Badge background
    ctx.fillStyle = color;
    ctx.fillRect(badgeX, badgeY, badgeW, badgeH);

    // Contrasting text color (black or white)
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
